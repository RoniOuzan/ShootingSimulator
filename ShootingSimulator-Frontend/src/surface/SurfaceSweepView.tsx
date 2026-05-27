import MultivariateLinearRegression from "ml-regression-multivariate-linear";
import { useMemo } from "react";
import ControlSlider from "../components/ControlSlider";
import ProgressOverlay from "../components/ProgressOverlay";
import { usePersistedState } from "../hooks/usePersistedState";
import type { SharedConfig, SimulationType } from "../types";
import CodeExporter, {
  getPolynomialFeatures,
  type ModelState,
} from "./CodeExporter";
import SurfaceSweepCharts from "./SurfaceSweepCharts";
import { TARGET_VARIABLES, VAR_KEYS } from "./shooterConfig";
import "../components/SharedConfigSidebar.css";

// ── Configuration Constants ──────────────────────────────────────────────────
export const REGIME_MARGIN = 0.05;

// ── Interfaces ───────────────────────────────────────────────────────────────
export interface DataPoint {
  distance: number;
  radialVelocity: number;
  outputs: Record<string, number>;
}

export interface DatasetState {
  normal: DataPoint[];
  min: DataPoint[];
  max: DataPoint[];
}

export interface VariableValidation {
  maxError: string;
  rmse: string;
  r2: string;
}

export interface RegimeValidation {
  metrics: Record<string, VariableValidation>;
  count: number;
}

export interface ValidationResult {
  normal: RegimeValidation | null;
  min: RegimeValidation | null;
  max: RegimeValidation | null;
  overall: Record<string, VariableValidation> | null;
}

interface Props {
  isConnected: boolean;
  surfaceData: any;
  sendMessage: (payload: any, showTime?: boolean) => void;
  sharedConfig: SharedConfig;
  isCalculating: boolean;
  calcProgress: number;
  eta: number;
}

function fitRegime(data: DataPoint[], regime: "normal" | "min" | "max"): ModelState {
  const result: ModelState = { models: {}, degrees: {} };
  if (data.length === 0) return result;

  for (const key of VAR_KEYS) {
    const config = TARGET_VARIABLES[key];
    const targetDeg = config.degrees[regime];
    
    if (targetDeg !== null) {
      let safeDeg = targetDeg;
      const minRequired = (d: number) => ((d + 1) * (d + 2)) / 2;
      while (safeDeg > 1 && data.length < minRequired(safeDeg)) safeDeg--;

      const X = data.map((p) => getPolynomialFeatures(p.distance, p.radialVelocity, safeDeg).features);
      const Y = data.map((p) => [p.outputs[key]]);
      
      result.models[key] = new MultivariateLinearRegression(X, Y, { intercept: false });
      result.degrees[key] = safeDeg;
    } else {
      result.models[key] = null;
      result.degrees[key] = null;
    }
  }
  return result;
}

function computeRegimeValidation(
  data: DataPoint[],
  modelState: ModelState | null,
  constantBounds: Record<string, number | null> = {}
): RegimeValidation | null {
  if (!modelState || data.length === 0) return null;

  const metrics: Record<string, VariableValidation> = {};

  for (const key of VAR_KEYS) {
    let sumSq = 0;
    let maxErr = 0;
    let ssTot = 0;
    const mean = data.reduce((s, p) => s + p.outputs[key], 0) / data.length;

    const model = modelState.models[key];
    const degree = modelState.degrees[key];
    const constantVal = constantBounds[key];

    for (const p of data) {
      let predicted: number;

      if (constantVal != null) {
        predicted = constantVal;
      } else if (model !== null && degree !== null) {
        const features = getPolynomialFeatures(p.distance, p.radialVelocity, degree).features;
        const raw = model.predict([features]);
        predicted = raw?.[0]?.[0];
      } else {
        continue;
      }

      if (predicted == null || !isFinite(predicted)) continue;

      const actual = p.outputs[key];
      const err = Math.abs(predicted - actual);
      if (!isFinite(err)) continue;

      maxErr = Math.max(maxErr, err);
      sumSq += err * err;
      ssTot += (actual - mean) ** 2;
    }

    const r2 = ssTot === 0 ? 1 : 1 - sumSq / ssTot;
    metrics[key] = {
      maxError: maxErr.toFixed(3),
      rmse: Math.sqrt(sumSq / data.length).toFixed(3),
      r2: (r2 * 100).toFixed(2),
    };
  }

  return { metrics, count: data.length };
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
  const [simulationType, setSimulationType] = usePersistedState<SimulationType>("sweep_simulationType", "CENTER");

  const boundaryKey = VAR_KEYS.find(k => TARGET_VARIABLES[k].isBoundaryAxis) || VAR_KEYS[0];

  const exportDataset = useMemo((): DatasetState => {
    const dataset: DatasetState = { normal: [], min: [], max: [] };
    if (!surfaceData?.distances || !surfaceData.radialVels) return dataset;

    const { distances, radialVels } = surfaceData;
    
    for (let i = 0; i < distances.length; i++) {
      for (let j = 0; j < radialVels.length; j++) {
        
        let isValid = true;
        const outputs: Record<string, number> = {};
        
        for (const key of VAR_KEYS) {
          const matrix = surfaceData[TARGET_VARIABLES[key].matrixKey];
          const val = matrix?.[i]?.[j];
          if (typeof val !== "number") isValid = false;
          outputs[key] = val;
        }

        if (!isValid) continue;

        const point: DataPoint = { distance: distances[i], radialVelocity: radialVels[j], outputs };
        const boundaryVal = outputs[boundaryKey];

        if (boundaryVal <= sharedConfig.hardware.minAngle + REGIME_MARGIN) {
          dataset.min.push(point);
        } else if (boundaryVal >= sharedConfig.hardware.maxAngle - REGIME_MARGIN) {
          dataset.max.push(point);
        } else {
          dataset.normal.push(point);
        }
      }
    }
    return dataset;
  }, [surfaceData, sharedConfig.hardware, boundaryKey]);

  const models = useMemo(() => ({
    normal: fitRegime(exportDataset.normal, "normal"),
    min: fitRegime(exportDataset.min, "min"),
    max: fitRegime(exportDataset.max, "max"),
  }), [exportDataset]);

  const values = useMemo(() => {
    if (!models.normal || !surfaceData?.distances?.length) return null;
    
    const result: Record<string, number[][]> = {};
    for (const key of VAR_KEYS) result[key] = [];

    const { minAngle, maxAngle } = sharedConfig.hardware;

    for (let j = 0; j < surfaceData.radialVels.length; j++) {
      const rows: Record<string, number[]> = {};
      for (const key of VAR_KEYS) rows[key] = [];

      for (let i = 0; i < surfaceData.distances.length; i++) {
        const d = surfaceData.distances[i];
        const vr = surfaceData.radialVels[j];
        
        const boundaryMatrix = surfaceData[TARGET_VARIABLES[boundaryKey].matrixKey];
        const actualBoundary = boundaryMatrix?.[i]?.[j] ?? null;

        let regimeModel = models.normal;
        let cBounds: Record<string, number | null> = {};

        if (actualBoundary !== null) {
          // We have real simulated data here
          if (actualBoundary <= minAngle + REGIME_MARGIN) {
            regimeModel = models.min;
            cBounds[boundaryKey] = minAngle;
          } else if (actualBoundary >= maxAngle - REGIME_MARGIN) {
            regimeModel = models.max;
            cBounds[boundaryKey] = maxAngle;
          }
        } else {
          // THE FIX: We have no simulated data here. We must predict the normal 
          // boundary first to check if we are extrapolating into a clamped regime!
          try {
            const normalDeg = models.normal.degrees[boundaryKey];
            const normalMod = models.normal.models[boundaryKey];
            
            if (normalDeg !== null && normalMod) {
              const f = getPolynomialFeatures(d, vr, normalDeg).features;
              const normalBoundaryPred = normalMod.predict([f])[0][0];

              if (normalBoundaryPred <= minAngle) {
                regimeModel = models.min;
                cBounds[boundaryKey] = minAngle;
              } else if (normalBoundaryPred >= maxAngle) {
                regimeModel = models.max;
                cBounds[boundaryKey] = maxAngle;
              }
            }
          } catch {
            // Failsafe: remain in normal regime if prediction fails
          }
        }

        // Generate the final values for all variables
        for (const key of VAR_KEYS) {
          try {
            // If this variable is clamped (like the Angle), push the constant and skip math
            if (cBounds[key] != null) {
              rows[key].push(cBounds[key]!);
              continue;
            }

            const model = regimeModel.models[key];
            const degree = regimeModel.degrees[key];

            if (model && degree !== null) {
              const f = getPolynomialFeatures(d, vr, degree).features;
              const val = model.predict([f])[0][0];
              rows[key].push(isFinite(val) ? val : (surfaceData[TARGET_VARIABLES[key].matrixKey]?.[i]?.[j] ?? 0));
            } else {
              rows[key].push(surfaceData[TARGET_VARIABLES[key].matrixKey]?.[i]?.[j] ?? 0);
            }
          } catch {
            rows[key].push(0);
          }
        }
      }
      for (const key of VAR_KEYS) result[key].push(rows[key]);
    }
    return result;
  }, [models, surfaceData, sharedConfig.hardware, boundaryKey]);

  const residuals = useMemo(() => {
    if (!values || !surfaceData?.distances) return null;
    const result: Record<string, (number | null)[][]> = {};

    for (const key of VAR_KEYS) {
      result[key] = [];
      const matrixKey = TARGET_VARIABLES[key].matrixKey;
      for (let j = 0; j < surfaceData.radialVels.length; j++) {
        const row: (number | null)[] = [];
        for (let i = 0; i < surfaceData.distances.length; i++) {
          const act = surfaceData[matrixKey]?.[i]?.[j];
          const pre = values[key][j]?.[i];
          row.push(act != null && pre != null ? Math.abs(pre - act) : null);
        }
        result[key].push(row);
      }
    }
    return result;
  }, [values, surfaceData]);

  const validation = useMemo((): ValidationResult => {
    if (!surfaceData?.distances || !values) {
      return { normal: null, min: null, max: null, overall: null };
    }

    const { minAngle, maxAngle } = sharedConfig.hardware;
    
    const normal = computeRegimeValidation(exportDataset.normal, models.normal);
    const min = computeRegimeValidation(exportDataset.min, models.min, { [boundaryKey]: minAngle });
    const max = computeRegimeValidation(exportDataset.max, models.max, { [boundaryKey]: maxAngle });

    const overallMetrics: Record<string, { maxErr: number, sumSq: number, count: number }> = {};
    for (const key of VAR_KEYS) overallMetrics[key] = { maxErr: 0, sumSq: 0, count: 0 };

    for (let i = 0; i < surfaceData.distances.length; i++) {
      for (let j = 0; j < surfaceData.radialVels.length; j++) {
        for (const key of VAR_KEYS) {
          const pre = values[key][j]?.[i];
          const act = surfaceData[TARGET_VARIABLES[key].matrixKey]?.[i]?.[j];
          
          if (pre != null && act != null && isFinite(pre) && isFinite(act)) {
            const err = Math.abs(pre - act);
            overallMetrics[key].maxErr = Math.max(overallMetrics[key].maxErr, err);
            overallMetrics[key].sumSq += err * err;
            overallMetrics[key].count++;
          }
        }
      }
    }

    const overall: Record<string, VariableValidation> = {};
    for (const key of VAR_KEYS) {
      const m = overallMetrics[key];
      if (m.count > 0) {
        overall[key] = {
          maxError: m.maxErr.toFixed(3),
          rmse: Math.sqrt(m.sumSq / m.count).toFixed(3),
          r2: "0", // R2 is typically calculated per regime, skipped overall for brevity
        };
      }
    }

    return { normal, min, max, overall: Object.keys(overall).length > 0 ? overall : null };
  }, [exportDataset, models, values, surfaceData, sharedConfig.hardware, boundaryKey]);

  const handleCalculate = () => {
    if (!isConnected || isCalculating) return;
    sendMessage(
      {
        type: "surface",
        data: {
          simulationType,
          targetAxis: sharedConfig.target.targetAxis,
          targetRadius: sharedConfig.target.targetRadius,
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
              {isConnected ? "Solver linked" : "Awaiting connection…"}
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
        <h2 className="sidebar-title">Surface Settings</h2>

        <div className="tab-config-card">
          <h3>Simulation Type</h3>
          <div className="mode-toggle" style={{ width: "100%" }}>
            <div className="mode-toggle-slider" style={{ transform: simulationType === "OPTIMAL" ? "translateX(100%)" : "translateX(0%)" }} />
            <button onClick={() => setSimulationType("CENTER")} className={`btn-toggle ${simulationType === "CENTER" ? "active-mode" : ""}`}>Center</button>
            <button onClick={() => setSimulationType("OPTIMAL")} className={`btn-toggle ${simulationType === "OPTIMAL" ? "active-mode" : ""}`}>Optimal</button>
          </div>
        </div>

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