import type { SharedConfig } from "../types";
import ControlSlider from "./ControlSlider";
import "./SharedConfigSidebar.css";

interface Props {
  config: SharedConfig;
  updateConfig: <K extends keyof SharedConfig>(
    section: K,
    updates: Partial<SharedConfig[K]>,
  ) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function SharedConfigSidebar({
  config,
  updateConfig,
  isCollapsed,
  onToggleCollapse,
}: Props) {
  const { origin, target, aerodynamics, hardware } = config;

  return (
    <div className={`shared-sidebar ${isCollapsed ? "collapsed" : ""}`}>
      <button className="collapse-toggle" onClick={onToggleCollapse}>
        {isCollapsed ? "▶" : "◀"}
        {!isCollapsed && <span>Collapse</span>}
      </button>

      {!isCollapsed && (
        <div className="sidebar-content">
          <h2 className="sidebar-title">Global Configuration</h2>

          {/* Origin Parameters */}
          <div className="config-card origin">
            <h3 className="card-title">
              <span className="icon">📍</span> Initial Position
            </h3>
            <div className="card-row">
              <ControlSlider
                label="X Position"
                value={origin.initialX}
                min={-10}
                max={10}
                step={0.1}
                unit="m"
                onChange={(v) => updateConfig("origin", { initialX: v })}
              />
              <ControlSlider
                label="Y Height"
                value={origin.initialY}
                min={0}
                max={5}
                step={0.1}
                unit="m"
                onChange={(v) => updateConfig("origin", { initialY: v })}
              />
            </div>
            <ControlSlider
              label="Radial Velocity"
              value={origin.radialVelocity}
              min={-4}
              max={4}
              step={0.1}
              unit="m/s"
              onChange={(v) => updateConfig("origin", { radialVelocity: v })}
            />
          </div>

          {/* Target Parameters */}
          <div className="config-card target">
            <h3 className="card-title">
              <span className="icon">🎯</span> Target Bounds
            </h3>
            <ControlSlider
              label="Target Height (Y)"
              value={target.targetY}
              min={0.5}
              max={5}
              step={0.05}
              unit="m"
              onChange={(v) => updateConfig("target", { targetY: v })}
            />
            <div className="card-row">
              <ControlSlider
                label="Min Hit Angle"
                value={target.minHitAngle}
                min={-90}
                max={target.maxHitAngle}
                step={1}
                unit="°"
                onChange={(v) => updateConfig("target", { minHitAngle: v })}
              />
              <ControlSlider
                label="Max Hit Angle"
                value={target.maxHitAngle}
                min={target.minHitAngle}
                max={90}
                step={1}
                unit="°"
                onChange={(v) => updateConfig("target", { maxHitAngle: v })}
              />
            </div>
            <div className="target-mode-container">
              <span className="mode-label">Target Axis</span>
              <div className="mode-toggle">
                <div
                  className="mode-toggle-slider"
                  style={{
                    transform:
                      config.target.targetAxis === "VERTICAL"
                        ? "translateX(100%)"
                        : "translateX(0%)",
                  }}
                />
                <button
                  onClick={() =>
                    updateConfig("target", { targetAxis: "HORIZONTAL" })
                  }
                  className={`btn-toggle ${config.target.targetAxis === "HORIZONTAL" ? "active-mode" : ""}`}
                >
                  Horizontal
                </button>
                <button
                  onClick={() =>
                    updateConfig("target", { targetAxis: "VERTICAL" })
                  }
                  className={`btn-toggle ${config.target.targetAxis === "VERTICAL" ? "active-mode" : ""}`}
                >
                  Vertical
                </button>
              </div>
            </div>
          </div>

          {/* Aerodynamics */}
          <div className="config-card aerodynamics">
            <h3 className="card-title">
              <span className="icon">💨</span> Aerodynamics
            </h3>
            <div className="card-row">
              <ControlSlider
                label="Mass"
                value={aerodynamics.mass}
                min={0.05}
                max={1}
                step={0.01}
                unit="kg"
                onChange={(v) => updateConfig("aerodynamics", { mass: v })}
              />
              <ControlSlider
                label="Diameter"
                value={aerodynamics.diameter}
                min={0.02}
                max={0.3}
                step={0.005}
                unit="m"
                onChange={(v) => updateConfig("aerodynamics", { diameter: v })}
              />
            </div>
            <ControlSlider
              label="Drag Coefficient"
              value={aerodynamics.dragCoeff}
              min={0.1}
              max={1.5}
              step={0.01}
              unit=" Cd"
              onChange={(v) => updateConfig("aerodynamics", { dragCoeff: v })}
            />
            <div className="card-divider" />
            <div className="card-row">
              <ControlSlider
                label="Spin Rate"
                value={aerodynamics.spinRPSPerMS}
                min={-2}
                max={2}
                step={0.1}
                unit=" rps/ms"
                onChange={(v) =>
                  updateConfig("aerodynamics", { spinRPSPerMS: v })
                }
              />
              <ControlSlider
                label="Magnus Coeff"
                value={aerodynamics.magnusCoeff}
                min={0}
                max={1}
                step={0.01}
                unit=" Cm"
                onChange={(v) =>
                  updateConfig("aerodynamics", { magnusCoeff: v })
                }
              />
            </div>
          </div>

          {/* Hardware Limits */}
          <div className="config-card hardware">
            <h3 className="card-title">
              <span className="icon">⚙️</span> Hardware Limits
            </h3>
            <div className="card-row">
              <ControlSlider
                label="Min Angle"
                value={hardware.minAngle}
                min={0}
                max={hardware.maxAngle}
                step={1}
                unit="°"
                onChange={(v) => updateConfig("hardware", { minAngle: v })}
              />
              <ControlSlider
                label="Max Angle"
                value={hardware.maxAngle}
                min={hardware.minAngle}
                max={90}
                step={1}
                unit="°"
                onChange={(v) => updateConfig("hardware", { maxAngle: v })}
              />
            </div>
            <div className="card-row">
              <ControlSlider
                label="Min Velocity"
                value={hardware.minVel}
                min={0}
                max={hardware.maxVel}
                step={0.5}
                unit="m/s"
                onChange={(v) => updateConfig("hardware", { minVel: v })}
              />
              <ControlSlider
                label="Max Velocity"
                value={hardware.maxVel}
                min={hardware.minVel}
                max={30}
                step={0.5}
                unit="m/s"
                onChange={(v) => updateConfig("hardware", { maxVel: v })}
              />
            </div>
            <div className="card-divider" />
            <div className="card-row">
              <ControlSlider
                label="Angle Error"
                value={hardware.estimatedAngleError}
                min={0.001}
                max={0.02}
                step={0.001}
                unit="°"
                precision={3}
                onChange={(v) =>
                  updateConfig("hardware", { estimatedAngleError: v })
                }
              />
              <ControlSlider
                label="Velocity Error"
                value={hardware.estimatedVelocityError}
                min={0.0001}
                max={0.002}
                step={0.0001}
                unit="m/s"
                precision={4}
                onChange={(v) =>
                  updateConfig("hardware", { estimatedVelocityError: v })
                }
              />
            </div>
          </div>

          {/* Reset Button */}
          <button
            className="reset-config-btn"
            onClick={() => {
              if (confirm("Reset all configuration to defaults?")) {
                localStorage.removeItem("sharedConfig");
                window.location.reload();
              }
            }}
          >
            Reset to Defaults
          </button>
        </div>
      )}
    </div>
  );
}
