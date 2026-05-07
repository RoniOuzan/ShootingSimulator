import MultivariateLinearRegression from "ml-regression-multivariate-linear";
import { useMemo } from "react";
import ControlSlider from "../components/ControlSlider";
import ProgressOverlay from "../components/ProgressOverlay";
import { usePersistedState } from "../hooks/usePersistedState";
import type { SharedConfig } from "../types";
import CodeExporter, {
  getPolynomialFeatures,
  type DataPoint,
  type DatasetState,
  type ModelState,
} from "./CodeExporter";
import SurfaceSweepCharts from "./SurfaceSweepCharts";

interface Props {
  isConnected: boolean;
  surfaceData: any;
  sendMessage: (payload: any, showTime?: boolean) => void;
  sharedConfig: SharedConfig;
  isCalculating: boolean;
  calcProgress: number;
  eta: number;
}

export interface RegimeValidation {
  angleMaxError: string;
  angleRmse: string;
  angleR2: string;
  velMaxError: string;
  velRmse: string;
  velR2: string;
  count: number;
}

export interface ValidationResult {
  normal: RegimeValidation | null;
  min: RegimeValidation | null;
  max: RegimeValidation | null;
  overall: {
    angleMaxError: string;
    angleRmse: string;
    velMaxError: string;
    velRmse: string;
  } | null;
}

function fitRegime(data: DataPoint[], angleDegree: number, velocityDegree: number) {
  if (data.length === 0) return null;
  const XAngle = data.map((p) =>
    getPolynomialFeatures(p.distance, p.radialVelocity, angleDegree).features
  );
  const XVelocity = data.map((p) =>
    getPolynomialFeatures(p.distance, p.radialVelocity, velocityDegree).features
  );
  const yAngle = data.map((p) => [p.bestAngle]);
  const yVelocity = data.map((p) => [p.bestExitVelocity]);
  return {
    angleModel: new MultivariateLinearRegression(XAngle, yAngle, {
      intercept: false,
    }),
    velocityModel: new MultivariateLinearRegression(XVelocity, yVelocity, {
      intercept: false,
    }),
    angleDegree,
    velocityDegree,
  };
}

function computeRegimeValidation(
  data: DataPoint[],
  model: ModelState | null
): RegimeValidation | null {
  if (!model || data.length === 0) return null;

  const calcStats = (type: "angle" | "velocity") => {
    let sumSq = 0;
    let maxErr = 0;
    const isAngle = type === "angle";
    const field = isAngle ? "bestAngle" : "bestExitVelocity";
    const innerModel = isAngle ? model.angleModel : model.velocityModel;
    const degree = isAngle ? model.angleDegree : model.velocityDegree;

    const mean = data.reduce((s, p) => s + p[field], 0) / data.length;
    let ssTot = 0;

    for (const p of data) {
      const features = getPolynomialFeatures(p.distance, p.radialVelocity, degree).features;
      const raw = innerModel.predict([features]);
      const predicted = raw?.[0]?.[0];
      if (predicted == null || !isFinite(predicted)) continue;

      const err = Math.abs(predicted - p[field]);
      if (!isFinite(err)) continue;

      maxErr = Math.max(maxErr, err);
      sumSq += err * err;
      ssTot += (p[field] - mean) ** 2;
    }

    const r2 = ssTot === 0 ? 1 : 1 - sumSq / ssTot;
    return {
      maxError: maxErr.toFixed(3),
      rmse: Math.sqrt(sumSq / data.length).toFixed(3),
      r2: (r2 * 100).toFixed(2),
    };
  };

  const angle = calcStats("angle");
  const vel = calcStats("velocity");

  return {
    angleMaxError: angle.maxError,
    angleRmse: angle.rmse,
    angleR2: angle.r2,
    velMaxError: vel.maxError,
    velRmse: vel.rmse,
    velR2: vel.r2,
    count: data.length,
  };
}

export const QUALITY_COLOR = (maxAngleErr: number, maxVelErr: number) => {
  if (maxAngleErr < 0.1 && maxVelErr < 0.05) return "#00e676";
  if (maxAngleErr < 0.5 && maxVelErr < 0.2) return "#ffd740";
  return "#ff5252";
};

export default function SurfaceSweepView({
  isConnected,
  surfaceData,
  sendMessage,
  sharedConfig,
  isCalculating,
  calcProgress,
  eta,
}: Props) {
  const [minDist, setMinDist] = usePersistedState("surface_minDist", 1);
  const [maxDist, setMaxDist] = usePersistedState("surface_maxDist", 8);
  const [distStep, setDistStep] = usePersistedState("surface_distStep", 0.2);
  const [minRadialVel, setMinRadialVel] = usePersistedState(
    "surface_minRadialVel",
    -4
  );
  const [maxRadialVel, setMaxRadialVel] = usePersistedState(
    "surface_maxRadialVel",
    4
  );
  const [radialVelStep, setRadialVelStep] = usePersistedState(
    "surface_radialVelStep",
    0.2
  );

  // ── Dataset bucketing ────────────────────────────────────────────────────
  const exportDataset = useMemo((): DatasetState => {
    const dataset: DatasetState = { normal: [], min: [], max: [] };
    if (!surfaceData?.angleMatrix || !surfaceData.distances || !surfaceData.radialVels)
      return dataset;

    const { distances, radialVels, angleMatrix, velocityMatrix } = surfaceData;
    
    for (let i = 0; i < distances.length; i++) {
      // 1. Guard against missing rows in the matrix
      const angleRow = angleMatrix[i];
      const velRow = velocityMatrix?.[i];
      
      if (!angleRow) continue; 

      for (let j = 0; j < radialVels.length; j++) {
        // 2. Safely access the specific point
        const angle = angleRow[j];
        const vel = velRow ? velRow[j] : null;

        if (typeof angle !== "number" || typeof vel !== "number") continue;

        const point: DataPoint = {
          distance: distances[i],
          radialVelocity: radialVels[j],
          bestAngle: angle,
          bestExitVelocity: vel,
        };

        const MARGIN = 0.05;
        if (angle <= sharedConfig.hardware.minAngle + MARGIN) {
          dataset.min.push(point);
        } else if (angle >= sharedConfig.hardware.maxAngle - MARGIN) {
          dataset.max.push(point);
        } else {
          dataset.normal.push(point);
        }
      }
    }
    return dataset;
  }, [surfaceData, sharedConfig.hardware.minAngle, sharedConfig.hardware.maxAngle]);

  // ── Model fitting ─────────────────────────────────────────────────────────
  // Degree-4 for normal gives enough flexibility to capture the curved
  // surface without overfitting. Clamped regimes stay at degree-2 since
  // they're nearly planar. A regime needs at least (degree+1)*(degree+2)/2
  // points to be overdetermined; fall back to lower degree if needed.
  const models = useMemo(() => {
    const safeFit = (data: DataPoint[], prefAngleDeg: number, prefVelDeg: number) => {
      if (data.length === 0) return null;
      
      const minRequired = (d: number) => ((d + 1) * (d + 2)) / 2;

      let aDeg = prefAngleDeg;
      while (aDeg > 1 && data.length < minRequired(aDeg)) aDeg--;

      let vDeg = prefVelDeg;
      while (vDeg > 1 && data.length < minRequired(vDeg)) vDeg--;

      return fitRegime(data, aDeg, vDeg);
    };

    return {
      normal: safeFit(exportDataset.normal, 4, 4),
      min: safeFit(exportDataset.min, 1, 2),
      max: safeFit(exportDataset.max, 1, 2),
    };
  }, [exportDataset]);

  // ── Predicted surface values ──────────────────────────────────────────────
  const values = useMemo(() => {
    if (
      !models.normal ||
      !surfaceData?.distances?.length ||
      !surfaceData?.radialVels?.length
    )
      return null;

    const angle: number[][] = [];
    const velocity: number[][] = [];

    // Helper: safely call predict and return null on any failure.
    const safePredict = (model: ModelState, d: number, vr: number): [number, number] | null => {
      try {
        const fA = getPolynomialFeatures(d, vr, model.angleDegree).features;
        const fV = getPolynomialFeatures(d, vr, model.velocityDegree).features;
        const a = model.angleModel.predict([fA])[0][0];
        const v = model.velocityModel.predict([fV])[0][0];
        if (a == null || v == null || !isFinite(a) || !isFinite(v)) return null;
        return [a, v];
      } catch {
        return null;
      }
    };

    // Precompute the MARGIN used during bucketing so regime selection is consistent
    const MARGIN = 0.05;
    const { minAngle, maxAngle } = sharedConfig.hardware;
    const hasAngleMatrix = !!surfaceData.angleMatrix;

    // Plotly expects z[row][col] where row is y (Radial Vel) and col is x (Distance).
    // The solver sends data as [distance_index][vel_index]. 
    // We must generate the prediction matrix in the [vel][dist] shape for Plotly.
    for (let j = 0; j < surfaceData.radialVels.length; j++) {
      const rowA: number[] = [];
      const rowV: number[] = [];

      for (let i = 0; i < surfaceData.distances.length; i++) {
        const d = surfaceData.distances[i];
        const vr = surfaceData.radialVels[j];

        // Use the ACTUAL simulated angle to decide regime — this is the ground
        // truth bucket the point belongs to, and matches exactly how exportDataset
        // was bucketed. Using the normal model's extrapolated prediction here was
        // the cause of regime mismatch in regions the normal model never trained on.
        const actualAngle: number | null = hasAngleMatrix
          ? (surfaceData.angleMatrix[i]?.[j] ?? null)
          : null;

        let regimeModel: ModelState | null;
        if (actualAngle !== null) {
          if (actualAngle <= minAngle + MARGIN) {
            regimeModel = models.min;
          } else if (actualAngle >= maxAngle - MARGIN) {
            regimeModel = models.max;
          } else {
            regimeModel = models.normal;
          }
        } else {
          // No ground truth available — fall back to normal model for regime detection
          const normalResult = safePredict(models.normal!, d, vr);
          const normalAngle = normalResult?.[0] ?? 0;
          if (normalAngle <= minAngle) regimeModel = models.min;
          else if (normalAngle >= maxAngle) regimeModel = models.max;
          else regimeModel = models.normal;
        }

        // Try the selected regime model
        let result: [number, number] | null = regimeModel
          ? safePredict(regimeModel, d, vr)
          : null;

        // Fallback cascade: normal → clamp angle to hardware bounds with normal velocity
        if (!result && regimeModel !== models.normal) {
          result = safePredict(models.normal!, d, vr);
        }
        if (!result) {
          // Last resort: use actual values so the surface stays complete
          const fa = actualAngle ?? 0;
          const fv = surfaceData.velocityMatrix?.[i]?.[j] ?? 0;
          result = [fa, fv];
        }

        rowA.push(result[0]);
        rowV.push(result[1]);
      }
      angle.push(rowA);
      velocity.push(rowV);
    }

    return { angle, velocity };
  }, [models, surfaceData, sharedConfig.hardware]);

  // ── Residuals matrix (for heatmap) ────────────────────────────────────────
  const residuals = useMemo(() => {
    if (!values || !surfaceData?.angleMatrix) return null;

    const dists = surfaceData.distances.length;
    const vels = surfaceData.radialVels.length;

    const resAngle: (number | null)[][] = [];
    const resVel: (number | null)[][] = [];

    for (let j = 0; j < vels; j++) {
      const rowA: (number | null)[] = [];
      const rowV: (number | null)[] = [];
      for (let i = 0; i < dists; i++) {
        const actA = surfaceData.angleMatrix[i]?.[j];
        const preA = values.angle[j]?.[i];
        rowA.push(actA != null && preA != null ? Math.abs(preA - actA) : null);

        const actV = surfaceData.velocityMatrix?.[i]?.[j];
        const preV = values.velocity[j]?.[i];
        rowV.push(actV != null && preV != null ? Math.abs(preV - actV) : null);
      }
      resAngle.push(rowA);
      resVel.push(rowV);
    }
    return { angle: resAngle, velocity: resVel };
  }, [values, surfaceData]);

  // ── Per-regime validation ─────────────────────────────────────────────────
  const validation = useMemo((): ValidationResult => {
    if (!surfaceData?.distances || !surfaceData?.radialVels || !values) {
      return { normal: null, min: null, max: null, overall: null };
    }

    const normal = computeRegimeValidation(exportDataset.normal, models.normal);
    const min = computeRegimeValidation(exportDataset.min, models.min);
    const max = computeRegimeValidation(exportDataset.max, models.max);

    // Overall across all points — guard every index access for NaN safety
    let aMaxErr = 0, aSumSq = 0;
    let vMaxErr = 0, vSumSq = 0;
    let allCount = 0;

    for (let i = 0; i < surfaceData.distances.length; i++) {
      for (let j = 0; j < surfaceData.radialVels.length; j++) {
        const preA = values.angle[j]?.[i];
        const actA = surfaceData.angleMatrix[i]?.[j];
        if (preA != null && actA != null && isFinite(preA) && isFinite(actA)) {
          const err = Math.abs(preA - actA);
          aMaxErr = Math.max(aMaxErr, err);
          aSumSq += err * err;
        }

        const preV = values.velocity[j]?.[i];
        const actV = surfaceData.velocityMatrix?.[i]?.[j];
        if (preV != null && actV != null && isFinite(preV) && isFinite(actV)) {
          const err = Math.abs(preV - actV);
          vMaxErr = Math.max(vMaxErr, err);
          vSumSq += err * err;
        }

        allCount++;
      }
    }

    const overall =
      allCount > 0
        ? {
            angleMaxError: aMaxErr.toFixed(3),
            angleRmse: Math.sqrt(aSumSq / allCount).toFixed(3),
            velMaxError: vMaxErr.toFixed(3),
            velRmse: Math.sqrt(vSumSq / allCount).toFixed(3),
          }
        : null;

    return { normal, min, max, overall };
  }, [exportDataset, models, values, surfaceData]);

  const handleCalculate = () => {
    if (!isConnected || isCalculating) return;
    sendMessage(
      {
        type: "surface",
        data: {
          targetAxis: sharedConfig.target.targetAxis,
          initialX: sharedConfig.origin.initialX,
          initialY: sharedConfig.origin.initialY,
          targetY: sharedConfig.target.targetY,
          minHitAngle: sharedConfig.target.minHitAngle,
          maxHitAngle: sharedConfig.target.maxHitAngle,
          sweepBounds: {
            minDist,
            maxDist,
            distStep,
            minRadialVel,
            maxRadialVel,
            radialVelStep,
          },
          physicalValues: {
            ...sharedConfig.hardware,
            ...sharedConfig.aerodynamics,
          },
        },
      },
      true
    );
  };

  const distPoints = Math.ceil((maxDist - minDist) / distStep);
  const velPoints = Math.ceil((maxRadialVel - minRadialVel) / radialVelStep);
  const totalPoints = distPoints * velPoints;
  const hasData = exportDataset.normal.length > 0;

  return (
    <div className="surface-view">
      <div className="charts-area">
        {/* ── Header ── */}
        <div className="charts-header">
          <div className="status-indicator">
            <span
              className={`status-dot ${isConnected ? "connected" : "disconnected"}`}
            />
            <span className="status-text">
              {isConnected ? "Solver linked — 3D mode" : "Awaiting connection…"}
            </span>
          </div>
          <button
            className="calculate-btn"
            onClick={handleCalculate}
            disabled={!isConnected || isCalculating}
          >
            <span className="icon">▶</span>
            {isCalculating ? "Calculating…" : "Generate surface"}
          </button>
        </div>

        <div className="charts-content">
          {isCalculating && (
            <ProgressOverlay
              progress={calcProgress}
              eta={eta}
              message="Building 3D surface map…"
            />
          )}

          <SurfaceSweepCharts
            data={surfaceData}
            values={values}
            residuals={residuals}
            validation={validation}
            models={models}
          />

          <div style={{ marginTop: 20 }}>
            <CodeExporter
              models={models}
              hardware={sharedConfig.hardware}
              datasetCounts={{
                normal: exportDataset.normal.length,
                min: exportDataset.min.length,
                max: exportDataset.max.length,
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Sidebar ── */}
      <div className="tab-sidebar">
        <h2 className="sidebar-title">Surface settings</h2>

        <div className="tab-config-card">
          <h3>Distance range (X-axis)</h3>
          <div style={{ display: "flex", gap: 12 }}>
            <ControlSlider
              label="Min"
              value={minDist}
              min={0.5}
              max={maxDist - 1}
              step={0.5}
              unit="m"
              onChange={setMinDist}
            />
            <ControlSlider
              label="Max"
              value={maxDist}
              min={minDist + 1}
              max={20}
              step={0.5}
              unit="m"
              onChange={setMaxDist}
            />
          </div>
          <ControlSlider
            label="Step size"
            value={distStep}
            min={0.05}
            max={1}
            step={0.05}
            unit="m"
            onChange={setDistStep}
          />
        </div>

        <div className="tab-config-card">
          <h3>Radial velocity (Y-axis)</h3>
          <div style={{ display: "flex", gap: 12 }}>
            <ControlSlider
              label="Min"
              value={minRadialVel}
              min={-6}
              max={maxRadialVel - 0.5}
              step={0.5}
              unit="m/s"
              onChange={setMinRadialVel}
            />
            <ControlSlider
              label="Max"
              value={maxRadialVel}
              min={minRadialVel + 0.5}
              max={6}
              step={0.5}
              unit="m/s"
              onChange={setMaxRadialVel}
            />
          </div>
          <ControlSlider
            label="Step size"
            value={radialVelStep}
            min={0.05}
            max={1}
            step={0.05}
            unit="m/s"
            onChange={setRadialVelStep}
          />
        </div>

        <div className="sweep-info">
          <p>
            <strong>Grid size:</strong> {distPoints} × {velPoints} ={" "}
            {totalPoints.toLocaleString()} points
          </p>
          {hasData && (
            <div style={{ marginTop: 8, fontSize: "0.8rem", color: "#888" }}>
              <div>Normal regime: {exportDataset.normal.length} pts</div>
              <div>Min-angle regime: {exportDataset.min.length} pts</div>
              <div>Max-angle regime: {exportDataset.max.length} pts</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}