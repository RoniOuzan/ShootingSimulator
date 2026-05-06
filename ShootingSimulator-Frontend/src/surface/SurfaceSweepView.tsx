import { usePersistedState } from "../hooks/usePersistedState";
import SurfaceSweepCharts from "./SurfaceSweepCharts";
import ControlSlider from "../components/ControlSlider";
import ProgressOverlay from "../components/ProgressOverlay";
import type { SharedConfig } from "../types";

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
  isConnected,
  surfaceData,
  sendMessage,
  sharedConfig,
  isCalculating,
  calcProgress,
  eta,
}: Props) {
  // Tab-specific settings with persistence
  const [minDist, setMinDist] = usePersistedState("surface_minDist", 1);
  const [maxDist, setMaxDist] = usePersistedState("surface_maxDist", 8);
  const [distStep, setDistStep] = usePersistedState("surface_distStep", 0.2);
  const [minRadialVel, setMinRadialVel] = usePersistedState(
    "surface_minRadialVel",
    -4,
  );
  const [maxRadialVel, setMaxRadialVel] = usePersistedState(
    "surface_maxRadialVel",
    4,
  );
  const [radialVelStep, setRadialVelStep] = usePersistedState(
    "surface_radialVelStep",
    0.2,
  );

  const handleCalculate = () => {
    if (!isConnected || isCalculating) return;

    const payload = {
      type: "surface",
      data: {
        targetMode: sharedConfig.targetMode,
        initialY: sharedConfig.origin.initialY,
        targetY: sharedConfig.target.targetY,
        tolX: sharedConfig.target.tolX,
        tolY: sharedConfig.target.tolY,
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
    };

    sendMessage(payload, true);
  };

  const distPoints = Math.ceil((maxDist - minDist) / distStep);
  const velPoints = Math.ceil((maxRadialVel - minRadialVel) / radialVelStep);
  const totalPoints = distPoints * velPoints;

  return (
    <div className="surface-view">
      {/* Charts Area */}
      <div className="charts-area">
        <div className="charts-header">
          <div className="status-indicator">
            <span
              className={`status-dot ${isConnected ? "connected" : "disconnected"}`}
            ></span>
            <span className="status-text">
              {isConnected
                ? "Solver Linked (3D Mode)"
                : "Awaiting Connection..."}
            </span>
          </div>

          <button
            className="calculate-btn"
            onClick={handleCalculate}
            disabled={!isConnected || isCalculating}
          >
            <span className="icon">▶</span>
            {isCalculating ? "Calculating..." : "Generate Surface"}
          </button>
        </div>

        <div className="charts-content">
          {isCalculating && (
            <ProgressOverlay
              progress={calcProgress}
              eta={eta}
              message="Building 3D surface map..."
            />
          )}
          <SurfaceSweepCharts data={surfaceData} />
        </div>
      </div>

      {/* Tab-Specific Config */}
      <div className="tab-sidebar">
        <h2 className="sidebar-title">Surface Settings</h2>

        <div className="tab-config-card">
          <h3>Distance Range (X-Axis)</h3>
          <div style={{ display: "flex", gap: "12px" }}>
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
            label="Step Size"
            value={distStep}
            min={0.05}
            max={1}
            step={0.05}
            unit="m"
            onChange={setDistStep}
          />
        </div>

        <div className="tab-config-card">
          <h3>Radial Velocity (Y-Axis)</h3>
          <div style={{ display: "flex", gap: "12px" }}>
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
            label="Step Size"
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
            <strong>Grid Size:</strong> {distPoints} × {velPoints} ={" "}
            {totalPoints.toLocaleString()} points
          </p>
          <p className="hint">
            Larger grids produce smoother surfaces but take longer to compute.
          </p>
        </div>
      </div>
    </div>
  );
}
