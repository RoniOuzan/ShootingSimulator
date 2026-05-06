import ControlSlider from "../components/ControlSlider";
import type { SimulationResults } from "../types";

interface SidebarProps {
  results: SimulationResults;
  targetX: number;
  setTargetX: (val: number) => void;
  isLockedX: boolean;
  setIsLockedX: (val: boolean) => void;
  isLockedY: boolean;
  setIsLockedY: (val: boolean) => void;
  isLockedOriginX: boolean;
  setIsLockedOriginX: (val: boolean) => void;
  isLockedOriginY: boolean;
  setIsLockedOriginY: (val: boolean) => void;
}

export default function TrajectorySidebar({
  results, targetX, setTargetX,
  isLockedX, setIsLockedX, isLockedY, setIsLockedY,
  isLockedOriginX, setIsLockedOriginX, isLockedOriginY, setIsLockedOriginY
}: SidebarProps) {
  return (
    <div className="tab-sidebar">
      <h2 className="sidebar-title">Trajectory Tuning</h2>

      <div className="tab-config-card" style={{ background: "rgba(0, 255, 136, 0.05)", borderLeft: "4px solid #00ff88" }}>
        <h3 style={{ color: "#00ff88" }}>Optimal Solution</h3>
        {results.bestInfo ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <span className="hint">Pitch Angle</span><br />
              <strong style={{ fontSize: "1.2rem", color: "#fff" }}>{results.bestInfo.angle.toFixed(4)}°</strong>
            </div>
            <div>
              <span className="hint">Velocity</span><br />
              <strong style={{ fontSize: "1.2rem", color: "#fff" }}>{results.bestInfo.velocity.toFixed(2)} m/s</strong>
            </div>
            <div style={{ gridColumn: "span 2", fontSize: "0.85rem", color: "#aaa", marginTop: "5px" }}>
              Selected from {results.trajectories.length} viable paths.
            </div>
          </div>
        ) : (
          <div style={{ color: "#ff4444", fontSize: "0.95rem" }}>Constraints exceeded. No valid paths found.</div>
        )}
      </div>

      <div className="tab-config-card">
        <h3>Canvas Locks</h3>
        <div style={{ marginBottom: "15px" }}>
          <span className="hint" style={{ display: "block", marginBottom: "8px" }}>Target Axis:</span>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setIsLockedX(!isLockedX)}
              className={`calculate-btn ${isLockedX ? "locked" : ""}`}
              style={{
                flex: 1, background: isLockedX ? "rgba(255, 153, 0, 0.2)" : "#333",
                border: isLockedX ? "1px solid #ff9900" : "1px solid transparent",
                color: isLockedX ? "#ff9900" : "#fff",
              }}
            >
              {isLockedX ? "🔒 X" : "🔓 X"}
            </button>
            <button
              onClick={() => setIsLockedY(!isLockedY)}
              className={`calculate-btn ${isLockedY ? "locked" : ""}`}
              style={{
                flex: 1, background: isLockedY ? "rgba(255, 153, 0, 0.2)" : "#333",
                border: isLockedY ? "1px solid #ff9900" : "1px solid transparent",
                color: isLockedY ? "#ff9900" : "#fff",
              }}
            >
              {isLockedY ? "🔒 Y" : "🔓 Y"}
            </button>
          </div>
        </div>

        <div>
          <span className="hint" style={{ display: "block", marginBottom: "8px" }}>Origin Axis:</span>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setIsLockedOriginX(!isLockedOriginX)}
              className={`calculate-btn ${isLockedOriginX ? "locked" : ""}`}
              style={{
                flex: 1, background: isLockedOriginX ? "rgba(68, 136, 255, 0.2)" : "#333",
                border: isLockedOriginX ? "1px solid #4488ff" : "1px solid transparent",
                color: isLockedOriginX ? "#4488ff" : "#fff",
              }}
            >
              {isLockedOriginX ? "🔒 X" : "🔓 X"}
            </button>
            <button
              onClick={() => setIsLockedOriginY(!isLockedOriginY)}
              className={`calculate-btn ${isLockedOriginY ? "locked" : ""}`}
              style={{
                flex: 1, background: isLockedOriginY ? "rgba(68, 136, 255, 0.2)" : "#333",
                border: isLockedOriginY ? "1px solid #4488ff" : "1px solid transparent",
                color: isLockedOriginY ? "#4488ff" : "#fff",
              }}
            >
              {isLockedOriginY ? "🔒 Y" : "🔓 Y"}
            </button>
          </div>
        </div>
      </div>

      <div className="tab-config-card">
        <h3>Target</h3>
        <ControlSlider
          label="Target X"
          value={targetX}
          min={1} max={18} step={0.1}
          unit="m"
          disabled={isLockedX}
          onChange={setTargetX}
        />
      </div>
    </div>
  );
}