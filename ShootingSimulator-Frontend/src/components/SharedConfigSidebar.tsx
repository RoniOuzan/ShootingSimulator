import { useEffect, useState } from "react";
import type { CostPreset, SharedConfig, ObstacleConfig } from "../types";
import ControlSlider from "./ControlSlider";
import "./SharedConfigSidebar.css";
import ObstacleManagingModel from "./ObstacleManagingModel";

interface Props {
  config: SharedConfig;
  updateConfig: <K extends keyof SharedConfig>(
    section: K,
    updates: Partial<SharedConfig[K]> | any, // Expanded slightly to easily accept full arrays for obstacles
  ) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const PRESETS: Record<
  Exclude<CostPreset, "CUSTOM">,
  Omit<SharedConfig["cost"], "preset">
> = {
  ROBUST: {
    robustnessWeight: 1.0,
    initialVelocityWeight: 0.0,
    impactVelocityWeight: 0.0,
    timeOfFlightWeight: 0.0,
    entryAngleWeight: 0.0,
    targetImpactAngle: 0,
  },
  SLOW_SHOT: {
    robustnessWeight: 0.5,
    initialVelocityWeight: 1.0,
    impactVelocityWeight: 0.3,
    timeOfFlightWeight: 0.0,
    entryAngleWeight: 0.0,
    targetImpactAngle: 0,
  },
  FAST_ARRIVAL: {
    robustnessWeight: 0.5,
    initialVelocityWeight: 0.0,
    impactVelocityWeight: 0.0,
    timeOfFlightWeight: 1.0,
    entryAngleWeight: 0.0,
    targetImpactAngle: 0,
  },
  SWISH: {
    robustnessWeight: 0.5,
    initialVelocityWeight: 0.0,
    impactVelocityWeight: 0.0,
    timeOfFlightWeight: 0.0,
    entryAngleWeight: 1.5,
    targetImpactAngle: -90,
  },
  BALANCED: {
    robustnessWeight: 1.0,
    initialVelocityWeight: 0.7,
    impactVelocityWeight: 0.1,
    timeOfFlightWeight: 0.1,
    entryAngleWeight: 0.2,
    targetImpactAngle: -45,
  },
};

export default function SharedConfigSidebar({
  config,
  updateConfig,
  isCollapsed,
  onToggleCollapse,
}: Props) {
  const {
    origin,
    target,
    aerodynamics,
    hardware,
    cost,
    obstacles = [],
  } = config;

  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const handlePresetChange = (preset: CostPreset) => {
    if (preset === "CUSTOM") {
      updateConfig("cost", { preset: "CUSTOM" });
    } else {
      updateConfig("cost", { preset, ...PRESETS[preset] });
    }
  };

  // --- Obstacle Management ---
  const handleAddObstacle = (type: "CIRCLE" | "POLYGON") => {
    const id = crypto.randomUUID ? crypto.randomUUID() : `obs_${Date.now()}`;
    const newObstacle: ObstacleConfig =
      type === "CIRCLE"
        ? {
            type: "CIRCLE",
            id,
            name: `Circle ${obstacles.length + 1}`,
            center: { x: 2, y: 2 },
            radius: 0.5,
          }
        : // Default triangle for polygon
          {
            type: "POLYGON",
            id,
            name: `Polygon ${obstacles.length + 1}`,
            vertices: [
              { x: 2, y: 1 },
              { x: 3, y: 1 },
              { x: 2.5, y: 2 },
            ],
          };

    updateConfig("obstacles", [...obstacles, newObstacle]);
  };

  const handleUpdateObstacle = (
    index: number,
    updates: Partial<ObstacleConfig>,
  ) => {
    const newObstacles = [...obstacles];
    newObstacles[index] = {
      ...newObstacles[index],
      ...updates,
    } as ObstacleConfig;
    updateConfig("obstacles", newObstacles);
  };

  const handleRemoveObstacle = (index: number) => {
    const newObstacles = obstacles.filter((_, i) => i !== index);
    updateConfig("obstacles", newObstacles);
  };

  const isCustom = cost.preset === "CUSTOM";

  return (
    <>
      {isEditorOpen && (
        <ObstacleManagingModel
          config={config}
          updateConfig={updateConfig}
          onClose={() => setIsEditorOpen(false)}
        />
      )}
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
              <ControlSlider
                label="Y Height"
                value={origin.initialY}
                min={0}
                max={5}
                step={0.1}
                unit="m"
                onChange={(v) => updateConfig("origin", { initialY: v })}
              />
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
                min={0}
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
                  onChange={(v) =>
                    updateConfig("aerodynamics", { diameter: v })
                  }
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
                  min={0.01}
                  max={0.2}
                  step={0.01}
                  unit="°"
                  precision={2}
                  onChange={(v) =>
                    updateConfig("hardware", { estimatedAngleError: v })
                  }
                />
                <ControlSlider
                  label="Velocity Error"
                  value={hardware.estimatedVelocityError}
                  min={0.001}
                  max={0.05}
                  step={0.001}
                  unit="m/s"
                  precision={3}
                  onChange={(v) =>
                    updateConfig("hardware", { estimatedVelocityError: v })
                  }
                />
              </div>
            </div>

            {/* Cost Function (Upgraded Design) */}
            <div className="config-card cost">
              <h3 className="card-title">
                <span className="icon">⚖️</span> Evaluation Cost Function
              </h3>

              <div className="preset-grid">
                <button
                  className={`preset-btn ${cost.preset === "ROBUST" ? "active" : ""}`}
                  onClick={() => handlePresetChange("ROBUST")}
                >
                  🛡️ Most Robust
                </button>
                <button
                  className={`preset-btn ${cost.preset === "SWISH" ? "active" : ""}`}
                  onClick={() => handlePresetChange("SWISH")}
                >
                  🎯 Clean Swish
                </button>
                <button
                  className={`preset-btn ${cost.preset === "FAST_ARRIVAL" ? "active" : ""}`}
                  onClick={() => handlePresetChange("FAST_ARRIVAL")}
                >
                  ⚡ Fast Arrival
                </button>
                <button
                  className={`preset-btn ${cost.preset === "SLOW_SHOT" ? "active" : ""}`}
                  onClick={() => handlePresetChange("SLOW_SHOT")}
                >
                  🐢 Slow Shot
                </button>
                <button
                  className={`preset-btn ${cost.preset === "BALANCED" ? "active" : ""}`}
                  onClick={() => handlePresetChange("BALANCED")}
                >
                  ⚖️ Balanced
                </button>
                <button
                  className={`preset-btn ${cost.preset === "CUSTOM" ? "active" : ""}`}
                  onClick={() => handlePresetChange("CUSTOM")}
                >
                  ⚙️ Custom Weights
                </button>
              </div>

              <div className="weights-status-header">
                {isCustom ? (
                  <span className="status-custom">
                    Active Custom Multipliers
                  </span>
                ) : (
                  <span className="status-locked">
                    🔒 Preset Multipliers (Read-Only)
                  </span>
                )}
              </div>

              <div className={`weights-container ${!isCustom ? "locked" : ""}`}>
                <WeightControl
                  icon="🛡️"
                  label="Robustness"
                  value={cost.robustnessWeight}
                  step={0.1}
                  onChange={(v) =>
                    updateConfig("cost", { robustnessWeight: v })
                  }
                />
                <WeightControl
                  icon="🚀"
                  label="Initial Velocity"
                  value={cost.initialVelocityWeight}
                  step={0.05}
                  onChange={(v) =>
                    updateConfig("cost", { initialVelocityWeight: v })
                  }
                />
                <WeightControl
                  icon="💥"
                  label="Impact Velocity"
                  value={cost.impactVelocityWeight}
                  step={0.05}
                  onChange={(v) =>
                    updateConfig("cost", { impactVelocityWeight: v })
                  }
                />
                <WeightControl
                  icon="⏱️"
                  label="Flight Time"
                  value={cost.timeOfFlightWeight}
                  step={0.1}
                  onChange={(v) =>
                    updateConfig("cost", { timeOfFlightWeight: v })
                  }
                />
                <WeightControl
                  icon="📐"
                  label="Angle Error"
                  value={cost.entryAngleWeight}
                  step={0.1}
                  onChange={(v) =>
                    updateConfig("cost", { entryAngleWeight: v })
                  }
                />

                <ControlSlider
                  label="Desired Impact Angle"
                  value={cost.targetImpactAngle}
                  min={target.minHitAngle}
                  max={target.maxHitAngle}
                  step={1}
                  unit="°"
                  onChange={(v) =>
                    updateConfig("cost", { targetImpactAngle: v })
                  }
                />
              </div>
            </div>

            {/* Obstacles Manager */}
            <div className="config-card obstacles">
              <h3 className="card-title">
                <span className="icon">🧱</span>Obstacles
              </h3>

              <button
                className="open-editor-btn"
                onClick={() => setIsEditorOpen(true)}
              >
                🗺️ Open Visual Editor
              </button>

              <div className="card-divider" />

              <div className="obstacles-list">
                {obstacles.length === 0 && (
                  <div className="no-obstacles">
                    No obstacles. Add one below.
                  </div>
                )}
                {obstacles.map((obs, index) => (
                  <div key={obs.id} className="obstacle-item">
                    <div className="obstacle-header">
                      <span className="obstacle-type">
                        {obs.type === "CIRCLE" ? "🔴" : "🛑"}
                      </span>
                      <input
                        type="text"
                        value={obs.name}
                        onChange={(e) =>
                          handleUpdateObstacle(index, { name: e.target.value })
                        }
                        className="obstacle-name-input"
                        placeholder="Obstacle Name"
                      />
                      <button
                        className="delete-btn"
                        onClick={() => handleRemoveObstacle(index)}
                        title="Delete Obstacle"
                      >
                        ✕
                      </button>
                    </div>

                    {obs.type === "CIRCLE" && (
                      <ControlSlider
                        label="Radius"
                        value={obs.radius}
                        min={0.1}
                        max={3}
                        step={0.05}
                        unit="m"
                        onChange={(v) =>
                          handleUpdateObstacle(index, { radius: v })
                        }
                      />
                    )}
                    {obs.type === "POLYGON" && (
                      <div className="obstacle-info-text">
                        Poly-Shape ({obs.vertices.length} points)
                      </div>
                    )}
                    <div className="obstacle-drag-hint">
                      ✎ Drag on canvas to move
                    </div>
                  </div>
                ))}
              </div>

              <div className="add-obstacle-buttons">
                <button onClick={() => handleAddObstacle("CIRCLE")}>
                  + Add Circle
                </button>
                <button onClick={() => handleAddObstacle("POLYGON")}>
                  + Add Polygon
                </button>
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
    </>
  );
}

function WeightControl({
  label,
  icon,
  value,
  step,
  onChange,
}: {
  label: string;
  icon: string;
  value: number;
  step: number;
  onChange: (val: number) => void;
}) {
  const [localVal, setLocalVal] = useState(value.toFixed(2));

  // Sync local input state if external value changes (like when clicking a preset)
  useEffect(() => {
    if (parseFloat(localVal) !== value) {
      setLocalVal(value.toFixed(2));
    }
  }, [value]);

  const handleDecrement = () => onChange(Math.max(0, value - step));
  const handleIncrement = () => onChange(value + step);

  // Update input text immediately as you type
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalVal(e.target.value);
    const parsed = parseFloat(e.target.value);
    if (!isNaN(parsed) && parsed >= 0) {
      onChange(parsed);
    }
  };

  // On blur, format the number back to a clean 2 decimal string
  const handleBlur = () => {
    const parsed = parseFloat(localVal);
    if (isNaN(parsed) || parsed < 0) {
      setLocalVal(value.toFixed(2)); // Revert if invalid text is typed
    } else {
      setLocalVal(parsed.toFixed(2));
      onChange(parsed);
    }
  };

  return (
    <div className="weight-control">
      <div className="weight-label">
        <span className="weight-icon">{icon}</span>
        {label}
      </div>
      <div className="weight-stepper">
        <button type="button" onClick={handleDecrement}>-</button>
        
        {/* New input container replacing the static div */}
        <div className="weight-input-container">
          <input
            type="number"
            step={step}
            value={localVal}
            onChange={handleChange}
            onBlur={handleBlur}
            className="weight-input"
          />
          <span className="weight-suffix">x</span>
        </div>
        
        <button type="button" onClick={handleIncrement}>+</button>
      </div>
    </div>
  );
}
