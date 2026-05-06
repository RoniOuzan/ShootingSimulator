import DistanceSweepCharts from "./DistanceSweepCharts";
import ControlSlider from "../components/ControlSlider";
import ProgressOverlay from "../components/ProgressOverlay";
import { usePersistedState } from "../hooks/usePersistedState";
import type { SharedConfig } from "../types";

interface Props {
  isConnected: boolean;
  sweepData: any[];
  sendMessage: (payload: any, showTime?: boolean) => void;
  sharedConfig: SharedConfig;
  isCalculating: boolean;
  calcProgress: number;
  eta: number;
}

export default function DistanceSweepView({
  isConnected,
  sweepData,
  sendMessage,
  sharedConfig,
  isCalculating,
  calcProgress,
  eta,
}: Props) {
  // Tab-specific settings with persistence
  const [minDist, setMinDist] = usePersistedState("sweep_minDist", 1);
  const [maxDist, setMaxDist] = usePersistedState("sweep_maxDist", 12);
  const [distStep, setDistStep] = usePersistedState("sweep_distStep", 0.1);

  const handleCalculate = () => {
    if (!isConnected || isCalculating) return;

    const payload = {
      type: "sweep",
      data: {
        targetMode: sharedConfig.targetMode,
        initialY: sharedConfig.origin.initialY,
        radialVelocity: sharedConfig.origin.radialVelocity,
        targetY: sharedConfig.target.targetY,
        tolX: sharedConfig.target.tolX,
        tolY: sharedConfig.target.tolY,
        minHitAngle: sharedConfig.target.minHitAngle,
        maxHitAngle: sharedConfig.target.maxHitAngle,
        sweepBounds: { minDist, maxDist, distStep },
        physicalValues: {
          ...sharedConfig.hardware,
          ...sharedConfig.aerodynamics,
        },
      },
    };

    sendMessage(payload, true);
  };

  return (
    <div className="sweep-view">
      {/* Charts Area */}
      <div className="charts-area">
        <div className="charts-header">
          <div className="status-indicator">
            <span
              className={`status-dot ${isConnected ? "connected" : "disconnected"}`}
            ></span>
            <span className="status-text">
              {isConnected ? "Solver Linked" : "Awaiting Connection..."}
            </span>
          </div>

          <button
            className="calculate-btn"
            onClick={handleCalculate}
            disabled={!isConnected || isCalculating}
          >
            <span className="icon">▶</span>
            {isCalculating ? "Calculating..." : "Calculate Sweep"}
          </button>
        </div>

        <div className="charts-content">
          {isCalculating && (
            <ProgressOverlay
              progress={calcProgress}
              eta={eta}
              message="Generating distance sweep..."
            />
          )}
          <DistanceSweepCharts data={sweepData} />
        </div>
      </div>

      {/* Tab-Specific Config */}
      <div className="tab-sidebar">
        <h2 className="sidebar-title">Sweep Settings</h2>

        <div className="tab-config-card">
          <h3>Distance Range (X-Axis)</h3>
          <div style={{ display: "flex", gap: "12px" }}>
            <ControlSlider
              label="Min Distance"
              value={minDist}
              min={0.5}
              max={maxDist - 0.5}
              step={0.5}
              unit="m"
              onChange={setMinDist}
            />
            <ControlSlider
              label="Max Distance"
              value={maxDist}
              min={minDist + 0.5}
              max={20}
              step={0.5}
              unit="m"
              onChange={setMaxDist}
            />
          </div>
          <ControlSlider
            label="Resolution"
            value={distStep}
            min={0.02}
            max={0.5}
            step={0.02}
            unit="m"
            onChange={setDistStep}
          />
        </div>

        <div className="sweep-info">
          <p>
            <strong>Points:</strong> {Math.ceil((maxDist - minDist) / distStep)}
          </p>
          <p className="hint">
            Adjust resolution for faster calculations or finer detail.
          </p>
        </div>
      </div>
    </div>
  );
}
