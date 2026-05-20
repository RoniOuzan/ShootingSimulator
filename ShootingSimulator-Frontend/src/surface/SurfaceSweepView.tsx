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

// ── Configuration Constants ──────────────────────────────────────────────────
export const REGIME_MARGIN = 0.05; // Margin (degrees) to separate normal regime from clamped min/max bounds

export const POLYNOMIAL_DEGREES = {
  NORMAL: { ANGLE: 5, VELOCITY: 5 },
  MIN: { ANGLE: null, VELOCITY: 3 },
  MAX: { ANGLE: null, VELOCITY: 3 },
};

export const FIT_THRESHOLDS = {
  EXCELLENT: { ANGLE_MAX_ERR: 0.15, VEL_MAX_ERR: 0.05, COLOR: "#00e676", LABEL: "✓ Excellent" },
  ACCEPTABLE: { ANGLE_MAX_ERR: 0.5, VEL_MAX_ERR: 0.2, COLOR: "#ffd740", LABEL: "⚠ Acceptable" },
  POOR: { COLOR: "#ff5252", LABEL: "✗ Poor fit" },
};

export const QUALITY_COLOR = (maxAngleErr: number, maxVelErr: number) => {
  if (
    maxAngleErr <= FIT_THRESHOLDS.EXCELLENT.ANGLE_MAX_ERR &&
    maxVelErr <= FIT_THRESHOLDS.EXCELLENT.VEL_MAX_ERR
  ) {
    return FIT_THRESHOLDS.EXCELLENT.COLOR;
  }
  if (
    maxAngleErr <= FIT_THRESHOLDS.ACCEPTABLE.ANGLE_MAX_ERR &&
    maxVelErr <= FIT_THRESHOLDS.ACCEPTABLE.VEL_MAX_ERR
  ) {
    return FIT_THRESHOLDS.ACCEPTABLE.COLOR;
  }
  return FIT_THRESHOLDS.POOR.COLOR;
};
// ─────────────────────────────────────────────────────────────────────────────

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

function fitRegime(
  data: DataPoint[],
  angleDegree: number | null,
  velocityDegree: number
) {
  if (data.length === 0) return null;

  const XVelocity = data.map((p) =>
    getPolynomialFeatures(p.distance, p.radialVelocity, velocityDegree).features
  );
  const yVelocity = data.map((p) => [p.bestExitVelocity]);

  let angleModel = null;
  if (angleDegree !== null) {
    const XAngle = data.map((p) =>
      getPolynomialFeatures(p.distance, p.radialVelocity, angleDegree).features
    );
    const yAngle = data.map((p) => [p.bestAngle]);
    angleModel = new MultivariateLinearRegression(XAngle, yAngle, {
      intercept: false,
    });
  }

  return {
    angleModel,
    velocityModel: new MultivariateLinearRegression(XVelocity, yVelocity, {
      intercept: false,
    }),
    angleDegree,
    velocityDegree,
  };
}

function computeRegimeValidation(
  data: DataPoint[],
  model: ModelState | null,
  constantAngle: number | null = null
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
      let predicted: number;

      if (isAngle && constantAngle !== null) {
        predicted = constantAngle;
      } else if (innerModel !== null && degree !== null) {
        const features = getPolynomialFeatures(
          p.distance,
          p.radialVelocity,
          degree
        ).features;
        const raw = innerModel.predict([features]);
        predicted = raw?.[0]?.[0];
      } else {
        continue;
      }

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
  const [minRadialVel, setMinRadialVel] = usePersistedState("surface_minRadialVel", -4);
  const [maxRadialVel, setMaxRadialVel] = usePersistedState("surface_maxRadialVel", 4);
  const [radialVelStep, setRadialVelStep] = usePersistedState("surface_radialVelStep", 0.2);

  // ── Dataset bucketing ────────────────────────────────────────────────────
  const exportDataset = useMemo((): DatasetState => {
    const dataset: DatasetState = { normal: [], min: [], max: [] };
    if (!surfaceData?.angleMatrix || !surfaceData.distances || !surfaceData.radialVels)
      return dataset;

    const { distances, radialVels, angleMatrix, velocityMatrix } = surfaceData;
    
    for (let i = 0; i < distances.length; i++) {
      const angleRow = angleMatrix[i];
      const velRow = velocityMatrix?.[i];
      
      if (!angleRow) continue; 

      for (let j = 0; j < radialVels.length; j++) {
        const angle = angleRow[j];
        const vel = velRow ? velRow[j] : null;

        if (typeof angle !== "number" || typeof vel !== "number") continue;

        const point: DataPoint = {
          distance: distances[i],
          radialVelocity: radialVels[j],
          bestAngle: angle,
          bestExitVelocity: vel,
        };

        if (angle <= sharedConfig.hardware.minAngle + REGIME_MARGIN) {
          dataset.min.push(point);
        } else if (angle >= sharedConfig.hardware.maxAngle - REGIME_MARGIN) {
          dataset.max.push(point);
        } else {
          dataset.normal.push(point);
        }
      }
    }
    return dataset;
  }, [surfaceData, sharedConfig.hardware.minAngle, sharedConfig.hardware.maxAngle]);

  // ── Model fitting ─────────────────────────────────────────────────────────
  const models = useMemo(() => {
    const safeFit = (
      data: DataPoint[],
      prefAngleDeg: number | null,
      prefVelDeg: number
    ) => {
      if (data.length === 0) return null;
      
      const minRequired = (d: number) => ((d + 1) * (d + 2)) / 2;

      let aDeg = prefAngleDeg;
      if (aDeg !== null) {
        while (aDeg > 1 && data.length < minRequired(aDeg)) aDeg--;
      }

      let vDeg = prefVelDeg;
      while (vDeg > 1 && data.length < minRequired(vDeg)) vDeg--;

      return fitRegime(data, aDeg, vDeg);
    };

    return {
      normal: safeFit(exportDataset.normal, POLYNOMIAL_DEGREES.NORMAL.ANGLE, POLYNOMIAL_DEGREES.NORMAL.VELOCITY),
      min: safeFit(exportDataset.min, POLYNOMIAL_DEGREES.MIN.ANGLE, POLYNOMIAL_DEGREES.MIN.VELOCITY),
      max: safeFit(exportDataset.max, POLYNOMIAL_DEGREES.MAX.ANGLE, POLYNOMIAL_DEGREES.MAX.VELOCITY),
    };
  }, [exportDataset]);

  // ── Predicted surface values ──────────────────────────────────────────────
  const values = useMemo(() => {
    if (!models.normal || !surfaceData?.distances?.length || !surfaceData?.radialVels?.length)
      return null;

    const angle: number[][] = [];
    const velocity: number[][] = [];

    const safePredict = (
      model: ModelState,
      d: number,
      vr: number,
      cAngle: number | null
    ): [number, number] | null => {
      try {
        let a: number | null = null;
        if (model.angleModel && model.angleDegree !== null) {
          const fA = getPolynomialFeatures(d, vr, model.angleDegree).features;
          a = model.angleModel.predict([fA])[0][0];
        } else if (cAngle !== null) {
          a = cAngle;
        }

        const fV = getPolynomialFeatures(d, vr, model.velocityDegree).features;
        const v = model.velocityModel.predict([fV])[0][0];

        if (a == null || v == null || !isFinite(a) || !isFinite(v)) return null;
        return [a, v];
      } catch {
        return null;
      }
    };

    const { minAngle, maxAngle } = sharedConfig.hardware;
    const hasAngleMatrix = !!surfaceData.angleMatrix;

    for (let j = 0; j < surfaceData.radialVels.length; j++) {
      const rowA: number[] = [];
      const rowV: number[] = [];

      for (let i = 0; i < surfaceData.distances.length; i++) {
        const d = surfaceData.distances[i];
        const vr = surfaceData.radialVels[j];

        const actualAngle: number | null = hasAngleMatrix
          ? (surfaceData.angleMatrix[i]?.[j] ?? null)
          : null;

        let regimeModel: ModelState | null;
        let cAngle: number | null = null;

        if (actualAngle !== null) {
          if (actualAngle <= minAngle + REGIME_MARGIN) {
            regimeModel = models.min;
            cAngle = minAngle;
          } else if (actualAngle >= maxAngle - REGIME_MARGIN) {
            regimeModel = models.max;
            cAngle = maxAngle;
          } else {
            regimeModel = models.normal;
          }
        } else {
          const normalResult = safePredict(models.normal!, d, vr, null);
          const normalAngle = normalResult?.[0] ?? 0;
          if (normalAngle <= minAngle) {
            regimeModel = models.min;
            cAngle = minAngle;
          } else if (normalAngle >= maxAngle) {
            regimeModel = models.max;
            cAngle = maxAngle;
          } else {
            regimeModel = models.normal;
          }
        }

        let result: [number, number] | null = regimeModel ? safePredict(regimeModel, d, vr, cAngle) : null;

        if (!result && regimeModel !== models.normal) {
          result = safePredict(models.normal!, d, vr, null);
          if (result && cAngle !== null) {
            result[0] = cAngle;
          }
        }
        if (!result) {
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

    const { minAngle, maxAngle } = sharedConfig.hardware;
    const normal = computeRegimeValidation(exportDataset.normal, models.normal);
    const min = computeRegimeValidation(exportDataset.min, models.min, minAngle);
    const max = computeRegimeValidation(exportDataset.max, models.max, maxAngle);

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
  }, [exportDataset, models, values, surfaceData, sharedConfig.hardware]);

  const handleCalculate = () => {
    if (!isConnected || isCalculating) return;
    sendMessage(
      {
        type: "surface",
        data: {
          targetAxis: sharedConfig.target.targetAxis,
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
          costConfig: sharedConfig.cost,
          obstacles: sharedConfig.obstacles, 
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

      <div className="tab-sidebar">
        <h2 className="sidebar-title">Surface settings</h2>

        <div className="tab-config-card">
          <h3>Distance range (X-axis)</h3>
          <div style={{ display: "flex", gap: 12 }}>
            <ControlSlider label="Min" value={minDist} min={0.5} max={maxDist - 1} step={0.5} unit="m" onChange={setMinDist} />
            <ControlSlider label="Max" value={maxDist} min={minDist + 1} max={20} step={0.5} unit="m" onChange={setMaxDist} />
          </div>
          <ControlSlider label="Step size" value={distStep} min={0.05} max={1} step={0.05} unit="m" onChange={setDistStep} />
        </div>

        <div className="tab-config-card">
          <h3>Radial velocity (Y-axis)</h3>
          <div style={{ display: "flex", gap: 12 }}>
            <ControlSlider label="Min" value={minRadialVel} min={-6} max={maxRadialVel - 0.5} step={0.5} unit="m/s" onChange={setMinRadialVel} />
            <ControlSlider label="Max" value={maxRadialVel} min={minRadialVel + 0.5} max={6} step={0.5} unit="m/s" onChange={setMaxRadialVel} />
          </div>
          <ControlSlider label="Step size" value={radialVelStep} min={0.05} max={1} step={0.05} unit="m/s" onChange={setRadialVelStep} />
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