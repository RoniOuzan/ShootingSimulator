import { useEffect, useRef, useState } from "react";
import { usePersistedState } from "../hooks/usePersistedState";
import type { SharedConfig, SimulationResults, Translation2d } from "../types";
import CostChart from "./CostChart";
import RobustnessChart from "./RobustnessChart";
import TrajectorySidebar from "./TrajectorySidebar";
import { TrajectoryCanvas } from "./TrajectoryCanvas";
import ToleranceGraph from "../optimal/ToleranceGraph";

interface Props {
  isConnected: boolean;
  results: SimulationResults;
  sendMessage: (payload: any, showTime?: boolean) => void;
  sharedConfig: SharedConfig;
  updateConfig: <K extends keyof SharedConfig>(
    section: K,
    updates: Partial<SharedConfig[K]>,
  ) => void;
}

export default function TrajectoryVisualizer({
  isConnected,
  results,
  sendMessage,
  sharedConfig,
  updateConfig,
}: Props) {
  // Persisted States
  const [initialX, setInitialX] = usePersistedState("traj_initialX", -4.0);
  const [isLockedOriginX, setIsLockedOriginX] = usePersistedState(
    "traj_lockOriginX",
    false,
  );
  const [isLockedOriginY, setIsLockedOriginY] = usePersistedState(
    "traj_lockOriginY",
    false,
  );
  const [isLockedY, setIsLockedY] = usePersistedState("traj_lockY", false);

  // Viewport States
  const DEFAULT_ZOOM = 100;
  const DEFAULT_PAN = { x: 900, y: 50 };
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);
  const [pan, setPan] = useState<Translation2d>(DEFAULT_PAN);

  const lastSendTime = useRef<number>(0);
  const sendTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Throttled Calculation Sender ---
  useEffect(() => {
    if (!isConnected) return;

    const payload = {
      type: "calculate",
      data: {
        targetAxis: sharedConfig.target.targetAxis,
        targetRadius: sharedConfig.target.targetRadius,
        initialY: sharedConfig.origin.initialY,
        initialX: initialX,
        radialVelocity: sharedConfig.origin.radialVelocity,
        targetY: sharedConfig.target.targetY,
        minHitAngle: sharedConfig.target.minHitAngle,
        maxHitAngle: sharedConfig.target.maxHitAngle,
        physicalValues: {
          ...sharedConfig.hardware,
          ...sharedConfig.aerodynamics,
        },
        costConfig: sharedConfig.cost,
        obstacles: sharedConfig.obstacles, 
        resolutionMode: sharedConfig.resolutionMode,
      },
    };

    const now = Date.now();
    const COOLDOWN_MS = 100;

    if (now - lastSendTime.current > COOLDOWN_MS) {
      sendMessage(payload, true);
      lastSendTime.current = now;
      if (sendTimeout.current) clearTimeout(sendTimeout.current);
    } else {
      if (sendTimeout.current) clearTimeout(sendTimeout.current);
      sendTimeout.current = setTimeout(
        () => {
          sendMessage(payload, true);
          lastSendTime.current = Date.now();
        },
        COOLDOWN_MS - (now - lastSendTime.current),
      );
    }
  }, [isConnected, sharedConfig, sendMessage, initialX]);

  const resetView = () => {
    setZoom(DEFAULT_ZOOM);
    setPan(DEFAULT_PAN);
  };

  return (
    <div className="sweep-view">
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

          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <span className="hint">
              Scroll: Zoom • Drag: Pan • Click/Drag: Target/Origin
            </span>
            <button
              className="calculate-btn"
              onClick={resetView}
              style={{ padding: "6px 12px" }}
            >
              Reset View
            </button>
          </div>
        </div>

        <div
          className="view-panel"
          style={{
            padding: 0,
            overflow: "hidden",
            minHeight: "600px",
            border: "1px solid #2a2a35",
            borderRadius: "8px",
          }}
        >
          <TrajectoryCanvas
            initialX={initialX}
            setInitialX={setInitialX}
            sharedConfig={sharedConfig}
            updateConfig={updateConfig}
            trajectoryGroups={[
              { 
                trajectories: results.trajectories, 
                color: "rgba(0, 255, 255, 0.1)", 
                lineWidth: 1.5 
              },
              { 
                trajectories: results.bestTrajectory ? [results.bestTrajectory] : [], 
                color: "#00ff88", 
                lineWidth: 3 
              }
            ]}
            zoom={zoom}
            setZoom={setZoom}
            pan={pan}
            setPan={setPan}
            isLockedY={isLockedY}
            isLockedOriginX={isLockedOriginX}
            isLockedOriginY={isLockedOriginY}
          />
        </div>

        <div style={{ display: "flex", gap: "20px", marginTop: "20px" }}>
          <div
            className="view-panel"
            style={{
              flex: 1,
              border: "1px solid #2a2a35",
              borderRadius: "8px",
              padding: "15px",
            }}
          >
            <h3
              style={{
                margin: "0 0 10px 0",
                fontSize: "1rem",
                color: "#fff",
              }}
            >
              Trajectory Robustness
            </h3>
            <RobustnessChart
              data={results.robustnessData}
              bestAngle={results.bestInfo?.angle ?? 0}
              minAngle={sharedConfig.hardware.minAngle}
              maxAngle={sharedConfig.hardware.maxAngle}
            />
          </div>
          <div
            className="view-panel"
            style={{
              flex: 1,
              border: "1px solid #2a2a35",
              borderRadius: "8px",
              padding: "15px",
            }}
          >
            <h3
              style={{
                margin: "0 0 10px 0",
                fontSize: "1rem",
                color: "#fff",
              }}
            >
              Trajectory Costs
            </h3>
            <CostChart
              data={results.costData}
              minAngle={sharedConfig.hardware.minAngle}
              maxAngle={sharedConfig.hardware.maxAngle}
              maxLimit={10}
            />
          </div>
        </div>

        {/* Bottom Half: The Velocity vs Angle Tolerance Graph */}
        <div className="view-panel" style={{ border: "1px solid #2a2a35", borderRadius: "8px", padding: "15px", minHeight: "400px" }}>
          <h3 style={{ margin: "0 0 15px 0", color: "#fff", fontSize: "1rem" }}>Tolerance Basin & Ellipse Fit</h3>
          <ToleranceGraph 
            closeTrajectories={results.trajectories}
            farTrajectories={results.trajectories}
            bestTrajectory={results.bestTrajectory}
            hardwareConfig={sharedConfig.hardware}
          />
        </div>
      </div>

      <TrajectorySidebar
        bestTrajectory={results.bestTrajectory}
        amountOfTrajectories={results.trajectories.length}
        initialX={initialX}
        setInitialX={setInitialX}
        isLockedY={isLockedY}
        setIsLockedY={setIsLockedY}
        isLockedOriginX={isLockedOriginX}
        setIsLockedOriginX={setIsLockedOriginX}
        isLockedOriginY={isLockedOriginY}
        setIsLockedOriginY={setIsLockedOriginY}
      />
    </div>
  );
}