import ControlSlider from "../components/ControlSlider";
import { parseVelocityVector, type Trajectory } from "../types";

interface SidebarProps {
  bestTrajectory: Trajectory | null;
  amountOfTrajectories: number;
  initialX: number;
  setInitialX: (val: number) => void;
  isLockedY: boolean;
  setIsLockedY: (val: boolean) => void;
  isLockedOriginX: boolean;
  setIsLockedOriginX: (val: boolean) => void;
  isLockedOriginY: boolean;
  setIsLockedOriginY: (val: boolean) => void;
}

export default function TrajectorySidebar({
  bestTrajectory, amountOfTrajectories, initialX, setInitialX, isLockedY, setIsLockedY,
  isLockedOriginX, setIsLockedOriginX, isLockedOriginY, setIsLockedOriginY
}: SidebarProps) {
  const tolerance = bestTrajectory?.tolerance;
  const parsedVelocity = parseVelocityVector(bestTrajectory?.initialShootingVelocity);

  return (
    <div className="tab-sidebar">
      <h2 className="sidebar-title">Trajectory Tuning</h2>

      <div className="tab-config-card" style={{ background: "rgba(0, 255, 136, 0.05)", borderLeft: "4px solid #00ff88" }}>
        <h3 style={{ color: "#00ff88" }}>Optimal Solution</h3>
        {bestTrajectory ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <span className="hint">Pitch Angle</span><br />
              <strong style={{ fontSize: "1.2rem", color: "#fff" }}>{parsedVelocity.angle.toFixed(4)}°</strong>
            </div>
            <div>
              <span className="hint">Velocity</span><br />
              <strong style={{ fontSize: "1.2rem", color: "#fff" }}>{parsedVelocity.velocity.toFixed(2)} m/s</strong>
            </div>
            <div style={{ gridColumn: "span 2", fontSize: "0.85rem", color: "#aaa", marginTop: "5px" }}>
              Selected from {amountOfTrajectories} viable paths.
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
        <h3>Initial</h3>
        <ControlSlider
          label="Initial X"
          value={initialX}
          min={-10} max={0} step={0.1}
          unit="m"
          disabled={isLockedOriginX}
          onChange={setInitialX}
        />
      </div>

      {tolerance && (
        <div className="sidebar-section">
          <h4>Shot Tolerance</h4>
          <div className="metric-row">
            <span>Velocity Range: </span>
            <span style={{ color: "#4ade80" }}>
              +{tolerance.velocityPositive.toFixed(2)}
            </span>
            <span style={{ color: "#f87171" }}>
              -{tolerance.velocityNegative.toFixed(2)} m/s
            </span>
          </div>
          <div className="metric-row">
            <span>Angle Range: </span>
            <span style={{ color: "#4ade80" }}>
              +{tolerance.anglePositive.toFixed(2)}°
            </span>
            <span style={{ color: "#f87171" }}>
              -{tolerance.angleNegative.toFixed(2)}°
            </span>
          </div>
          <div className="metric-row">
            <span>Ellipse Angle: </span>
            <span style={{ color: "#4acade", fontWeight: "bold" }}>
              {tolerance.ellipseAngle.toFixed(3)}°
            </span>
          </div>
        </div>
      )}
    </div>
  );
}