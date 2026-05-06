import MultivariateLinearRegression from "ml-regression-multivariate-linear";
import { useMemo } from "react";
import ControlSlider from "../components/ControlSlider";
import ProgressOverlay from "../components/ProgressOverlay";
import { usePersistedState } from "../hooks/usePersistedState";
import type { SharedConfig } from "../types";
import CodeExporter, { getPolynomialFeatures, type DataPoint, type DatasetState } from "./CodeExporter";
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

export default function SurfaceSweepView({
  isConnected, surfaceData, sendMessage, sharedConfig, isCalculating, calcProgress, eta,
}: Props) {
  const [minDist, setMinDist] = usePersistedState("surface_minDist", 1);
  const [maxDist, setMaxDist] = usePersistedState("surface_maxDist", 8);
  const [distStep, setDistStep] = usePersistedState("surface_distStep", 0.2);
  const [minRadialVel, setMinRadialVel] = usePersistedState("surface_minRadialVel", -4);
  const [maxRadialVel, setMaxRadialVel] = usePersistedState("surface_maxRadialVel", 4);
  const [radialVelStep, setRadialVelStep] = usePersistedState("surface_radialVelStep", 0.2);

  const exportDataset = useMemo((): DatasetState => {
    // Initialize with empty arrays to ensure the type is always consistent
    const dataset: DatasetState = { normal: [], min: [], max: [] };
    
    if (!surfaceData?.angleMatrix || !surfaceData.distances || !surfaceData.radialVels) {
      return dataset;
    }
    
    const { distances, radialVels, angleMatrix, velocityMatrix } = surfaceData;

    for (let i = 0; i < distances.length; i++) {
      for (let j = 0; j < radialVels.length; j++) {
        const angle = angleMatrix[i][j];
        const vel = velocityMatrix[i][j];

        if (typeof angle !== 'number' || typeof vel !== 'number') continue;

        const point: DataPoint = { 
          distance: distances[i], 
          radialVelocity: radialVels[j], 
          bestAngle: angle, 
          bestExitVelocity: vel 
        };

        // Sort into buckets
        if (angle <= sharedConfig.hardware.minAngle + 1e-6) {
          dataset.min.push(point);
        } else if (angle >= sharedConfig.hardware.maxAngle - 1e-6) {
          dataset.max.push(point);
        } else {
          dataset.normal.push(point);
        }
      }
    }
    return dataset;
  }, [surfaceData, sharedConfig.hardware.minAngle, sharedConfig.hardware.maxAngle]);

  const models = useMemo(() => {
    const fitRegime = (data: DataPoint[], degree: number) => {
      if (data.length === 0) return null;
      const X = data.map((p) => getPolynomialFeatures(p.distance, p.radialVelocity, degree).features);
      const yAngle = data.map((p) => [p.bestAngle]);
      const yVelocity = data.map((p) => [p.bestExitVelocity]);

      return {
        angleModel: new MultivariateLinearRegression(X, yAngle, { intercept: false }),
        velocityModel: new MultivariateLinearRegression(X, yVelocity, { intercept: false }),
        degree
      };
    };

    return {
      normal: fitRegime(exportDataset.normal, 3),
      min: fitRegime(exportDataset.min, 2),
      max: fitRegime(exportDataset.max, 2)
    };
  }, [exportDataset]);

  const validation = useMemo(() => {
    if (exportDataset.normal.length < 10 || !models) return null;

    const X = exportDataset.normal.map((p) => getPolynomialFeatures(p.distance, p.radialVelocity, 3).features);
    
    let maxError = 0;
    let sumSquaredError = 0;

    exportDataset.normal.forEach((p, idx) => {
      const predictionResult = models.normal?.angleModel.predict([X[idx]]);
      
      // Strict check: Result exists, is array, and has inner value
      if (Array.isArray(predictionResult) && 
          predictionResult.length > 0 && 
          Array.isArray(predictionResult[0]) &&
          predictionResult[0][0] !== undefined) {
          
        const prediction = predictionResult[0][0];
        const error = Math.abs(p.bestAngle - prediction);
        maxError = Math.max(maxError, error);
        sumSquaredError += Math.pow(error, 2);
      }
    });

    return { 
      maxError: maxError.toFixed(4), 
      rmse: Math.sqrt(sumSquaredError / exportDataset.normal.length).toFixed(4) 
    };
  }, [exportDataset]);

  const handleCalculate = () => {
    if (!isConnected || isCalculating) return;
    const payload = {
      type: "surface",
      data: {
        targetAxis: sharedConfig.target.targetAxis,
        initialX: sharedConfig.origin.initialX, initialY: sharedConfig.origin.initialY,
        targetY: sharedConfig.target.targetY,
        minHitAngle: sharedConfig.target.minHitAngle, maxHitAngle: sharedConfig.target.maxHitAngle,
        sweepBounds: { minDist, maxDist, distStep, minRadialVel, maxRadialVel, radialVelStep },
        physicalValues: { ...sharedConfig.hardware, ...sharedConfig.aerodynamics },
      },
    };
    sendMessage(payload, true);
  };

  const distPoints = Math.ceil((maxDist - minDist) / distStep);
  const velPoints = Math.ceil((maxRadialVel - minRadialVel) / radialVelStep);
  const totalPoints = distPoints * velPoints;

  return (
    <div className="surface-view">
      <div className="charts-area">
        <div className="charts-header">
          <div className="status-indicator">
            <span className={`status-dot ${isConnected ? "connected" : "disconnected"}`}></span>
            <span className="status-text">{isConnected ? "Solver Linked (3D Mode)" : "Awaiting Connection..."}</span>
          </div>
          <button className="calculate-btn" onClick={handleCalculate} disabled={!isConnected || isCalculating}>
            <span className="icon">▶</span> {isCalculating ? "Calculating..." : "Generate Surface"}
          </button>
        </div>

        <div className="charts-content">
          {isCalculating && <ProgressOverlay progress={calcProgress} eta={eta} message="Building 3D surface map..." />}
          <SurfaceSweepCharts data={surfaceData} models={models} hardware={sharedConfig.hardware} />
          
          {exportDataset.normal.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              {validation && (
                 <div className="tab-config-card" style={{ marginBottom: "10px", borderColor: Number(validation.maxError) < 0.1 ? "#00ff88" : "#ff4444" }}>
                    <h3>Regression Accuracy</h3>
                    <p>Max Deviation: <strong>{validation.maxError}°</strong> | RMS Error: <strong>{validation.rmse}°</strong></p>
                 </div>
              )}
              <CodeExporter models={models} hardware={sharedConfig.hardware} />
            </div>
          )}
        </div>
      </div>

      <div className="tab-sidebar">
        <h2 className="sidebar-title">Surface Settings</h2>
        <div className="tab-config-card">
          <h3>Distance Range (X-Axis)</h3>
          <div style={{ display: "flex", gap: "12px" }}>
            <ControlSlider label="Min" value={minDist} min={0.5} max={maxDist - 1} step={0.5} unit="m" onChange={setMinDist} />
            <ControlSlider label="Max" value={maxDist} min={minDist + 1} max={20} step={0.5} unit="m" onChange={setMaxDist} />
          </div>
          <ControlSlider label="Step Size" value={distStep} min={0.05} max={1} step={0.05} unit="m" onChange={setDistStep} />
        </div>
        <div className="tab-config-card">
          <h3>Radial Velocity (Y-Axis)</h3>
          <div style={{ display: "flex", gap: "12px" }}>
            <ControlSlider label="Min" value={minRadialVel} min={-10} max={maxRadialVel - 0.5} step={0.5} unit="m/s" onChange={setMinRadialVel} />
            <ControlSlider label="Max" value={maxRadialVel} min={minRadialVel + 0.5} max={10} step={0.5} unit="m/s" onChange={setMaxRadialVel} />
          </div>
          <ControlSlider label="Step Size" value={radialVelStep} min={0.05} max={1} step={0.05} unit="m/s" onChange={setRadialVelStep} />
        </div>
        <div className="sweep-info">
          <p><strong>Grid Size:</strong> {distPoints} × {velPoints} = {totalPoints.toLocaleString()} points</p>
        </div>
      </div>
    </div>
  );
}