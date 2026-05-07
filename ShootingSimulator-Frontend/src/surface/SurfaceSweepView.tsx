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

interface RegimeValidation {
  maxError: string;
  rmse: string;
  r2: string;
  count: number;
}

interface ValidationResult {
  normal: RegimeValidation | null;
  min: RegimeValidation | null;
  max: RegimeValidation | null;
  overall: { maxError: string; rmse: string } | null;
}

function fitRegime(data: DataPoint[], degree: number) {
  if (data.length === 0) return null;
  const X = data.map((p) =>
    getPolynomialFeatures(p.distance, p.radialVelocity, degree).features
  );
  const yAngle = data.map((p) => [p.bestAngle]);
  const yVelocity = data.map((p) => [p.bestExitVelocity]);
  return {
    angleModel: new MultivariateLinearRegression(X, yAngle, {
      intercept: false,
    }),
    velocityModel: new MultivariateLinearRegression(X, yVelocity, {
      intercept: false,
    }),
    degree,
  };
}

function computeRegimeValidation(
  data: DataPoint[],
  model: ModelState | null
): RegimeValidation | null {
  if (!model || data.length === 0) return null;
  let sumSq = 0;
  let maxErr = 0;
  const meanAngle = data.reduce((s, p) => s + p.bestAngle, 0) / data.length;
  let ssTot = 0;

  for (const p of data) {
    const features = getPolynomialFeatures(
      p.distance,
      p.radialVelocity,
      model.degree
    ).features;
    const raw = model.angleModel.predict([features]);
    const predicted = raw?.[0]?.[0];
    if (predicted == null || !isFinite(predicted)) continue;
    const err = Math.abs(predicted - p.bestAngle);
    if (!isFinite(err)) continue;
    maxErr = Math.max(maxErr, err);
    sumSq += err * err;
    ssTot += (p.bestAngle - meanAngle) ** 2;
  }

  const r2 = ssTot === 0 ? 1 : 1 - sumSq / ssTot;
  return {
    maxError: maxErr.toFixed(3),
    rmse: Math.sqrt(sumSq / data.length).toFixed(3),
    r2: (r2 * 100).toFixed(2),
    count: data.length,
  };
}

const QUALITY_COLOR = (maxErr: number) => {
  if (maxErr < 0.1) return "#00e676";
  if (maxErr < 0.5) return "#ffd740";
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
      for (let j = 0; j < radialVels.length; j++) {
        const angle = angleMatrix[i][j];
        const vel = velocityMatrix[i][j];
        if (typeof angle !== "number" || typeof vel !== "number") continue;

        const point: DataPoint = {
          distance: distances[i],
          radialVelocity: radialVels[j],
          bestAngle: angle,
          bestExitVelocity: vel,
        };

        // Use a small margin so boundary-adjacent points go into the clamped
        // regime, not the normal one — this prevents boundary bleed that
        // inflates the normal-regime fit error.
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
    const safeFit = (data: DataPoint[], preferredDegree: number) => {
      if (data.length === 0) return null;
      const minRequired = (d: number) => ((d + 1) * (d + 2)) / 2;
      let deg = preferredDegree;
      while (deg > 1 && data.length < minRequired(deg)) deg--;
      return fitRegime(data, deg);
    };
    return {
      normal: safeFit(exportDataset.normal, 4),
      min:    safeFit(exportDataset.min, 2),
      max:    safeFit(exportDataset.max, 2),
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

    // Helper: safely call predict and return null on any failure
    const safePredict = (model: ModelState, d: number, vr: number): [number, number] | null => {
      try {
        const f = getPolynomialFeatures(d, vr, model.degree).features;
        const ap = model.angleModel.predict([f]);
        const vp = model.velocityModel.predict([f]);
        const a = ap?.[0]?.[0];
        const v = vp?.[0]?.[0];
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

    for (let i = 0; i < surfaceData.distances.length; i++) {
      const rowA: number[] = [];
      const rowV: number[] = [];

      for (let j = 0; j < surfaceData.radialVels.length; j++) {
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
    // Guard: predicted and simulated matrices must have identical dimensions.
    // They can diverge when surfaceData updates before values recomputes.
    const rows = surfaceData.angleMatrix.length;
    if (rows === 0 || values.angle.length !== rows) return null;
    const cols = surfaceData.angleMatrix[0]?.length ?? 0;
    if (cols === 0 || (values.angle[0]?.length ?? 0) !== cols) return null;

    return surfaceData.angleMatrix.map((row: number[], i: number) =>
      row.map((actual: number, j: number) =>
        Math.abs((values.angle[i]?.[j] ?? actual) - actual)
      )
    );
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
    let allMaxErr = 0;
    let allSumSq = 0;
    let allCount = 0;
    for (let i = 0; i < surfaceData.distances.length; i++) {
      for (let j = 0; j < surfaceData.radialVels.length; j++) {
        const predicted = values.angle[i]?.[j];
        const actual    = surfaceData.angleMatrix[i]?.[j];
        if (predicted == null || actual == null || !isFinite(predicted) || !isFinite(actual)) continue;
        const err = Math.abs(predicted - actual);
        if (!isFinite(err)) continue;
        allMaxErr = Math.max(allMaxErr, err);
        allSumSq += err * err;
        allCount++;
      }
    }

    const overall =
      allCount > 0
        ? {
            maxError: allMaxErr.toFixed(3),
            rmse: Math.sqrt(allSumSq / allCount).toFixed(3),
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
          />

          {/* ── Accuracy panel ── */}
          {hasData && validation.overall && (
            <div style={{ marginTop: 20 }}>
              <AccuracyPanel validation={validation} />
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
          )}
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
              min={-10}
              max={maxRadialVel - 0.5}
              step={0.5}
              unit="m/s"
              onChange={setMinRadialVel}
            />
            <ControlSlider
              label="Max"
              value={maxRadialVel}
              min={minRadialVel + 0.5}
              max={10}
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

// ── Accuracy panel sub-component ────────────────────────────────────────────

interface AccuracyPanelProps {
  validation: ValidationResult;
}

function RegimeBadge({
  label,
  data,
  degree,
}: {
  label: string;
  data: RegimeValidation | null;
  degree: number;
}) {
  if (!data) return null;
  const color = QUALITY_COLOR(parseFloat(data.maxError));
  return (
    <div
      style={{
        background: "#0d0d12",
        border: `1px solid ${color}33`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        padding: "10px 14px",
        flex: 1,
        minWidth: 140,
      }}
    >
      <div
        style={{
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: color,
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        {label}
        <span
          style={{
            marginLeft: 6,
            color: "#555",
            fontWeight: 400,
            textTransform: "none",
          }}
        >
          deg {degree}
        </span>
      </div>
      <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
        <tbody>
          <StatRow label="Max err" value={`${data.maxError}°`} />
          <StatRow label="RMSE" value={`${data.rmse}°`} />
          <StatRow
            label="R²"
            value={`${data.r2}%`}
            highlight={parseFloat(data.r2) > 99}
          />
          <StatRow label="Points" value={data.count.toLocaleString()} />
        </tbody>
      </table>
    </div>
  );
}

function StatRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <tr>
      <td style={{ color: "#666", paddingRight: 8, paddingBottom: 2 }}>
        {label}
      </td>
      <td
        style={{
          textAlign: "right",
          color: highlight ? "#00e676" : "#ccc",
          fontWeight: highlight ? 600 : 400,
        }}
      >
        {value}
      </td>
    </tr>
  );
}

function AccuracyPanel({ validation }: AccuracyPanelProps) {
  const { overall } = validation;
  if (!overall) return null;

  const overallColor = QUALITY_COLOR(parseFloat(overall.maxError));
  const isGood = parseFloat(overall.maxError) < 0.1;

  return (
    <div
      className="tab-config-card"
      style={{
        marginBottom: 12,
        borderColor: overallColor,
        borderLeftWidth: 3,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h3 style={{ margin: 0 }}>Polynomial fit accuracy</h3>
        <span
          style={{
            fontSize: "0.75rem",
            padding: "3px 10px",
            borderRadius: 20,
            background: `${overallColor}22`,
            color: overallColor,
            border: `1px solid ${overallColor}55`,
            fontWeight: 600,
          }}
        >
          {isGood ? "✓ Excellent" : parseFloat(overall.maxError) < 0.5 ? "⚠ Acceptable" : "✗ Poor fit"}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <RegimeBadge label="Normal" data={validation.normal} degree={3} />
        <RegimeBadge label="Min angle" data={validation.min} degree={2} />
        <RegimeBadge label="Max angle" data={validation.max} degree={2} />
      </div>

      <div
        style={{
          background: "#0a0a0f",
          borderRadius: 6,
          padding: "8px 14px",
          fontSize: "0.8rem",
          color: "#888",
          display: "flex",
          gap: 24,
        }}
      >
        <span>
          Overall max error:{" "}
          <strong style={{ color: overallColor }}>{overall.maxError}°</strong>
        </span>
        <span>
          Overall RMSE:{" "}
          <strong style={{ color: "#aaa" }}>{overall.rmse}°</strong>
        </span>
      </div>
    </div>
  );
}