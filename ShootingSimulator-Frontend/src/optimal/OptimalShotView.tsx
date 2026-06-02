import { useEffect, useRef, useState } from "react";
import { usePersistedState } from "../hooks/usePersistedState";
import { parseVelocityVector, type OptimalResults, type SharedConfig, type TrajectoryCouple, type Translation2d } from "../types";
import { TrajectoryCanvas } from "../visualizer/TrajectoryCanvas";
import CostChart from "../visualizer/CostChart";
import ToleranceGraph from "./ToleranceGraph";
import TrajectorySidebar from "../visualizer/TrajectorySidebar";
import RobustnessChart from "../visualizer/RobustnessChart";

interface Props {
  isConnected: boolean;
  results: OptimalResults;
  sendMessage: (payload: any, showTime?: boolean) => void;
  sharedConfig: SharedConfig;
  updateConfig: <K extends keyof SharedConfig>(
    section: K,
    updates: Partial<SharedConfig[K]>
  ) => void;
}

export default function OptimalShotView({
  isConnected,
  results,
  sendMessage,
  sharedConfig,
  updateConfig,
}: Props) {
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
  
  // Viewport States for the Trajectory Canvas
  const DEFAULT_ZOOM = 100;
  const DEFAULT_PAN = { x: 900, y: 50 };
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);
  const [pan, setPan] = useState<Translation2d>(DEFAULT_PAN);

  const lastSendTime = useRef<number>(0);
  const sendTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Throttle WS requests to avoid unnecessary CPU load
  useEffect(() => {
    if (!isConnected) return;

    const payload = {
      type: "optimal",
      data: {
        initialX: initialX,
        initialY: sharedConfig.origin.initialY,
        radialVelocity: sharedConfig.origin.radialVelocity,
        targetY: sharedConfig.target.targetY,
        targetRadius: sharedConfig.target.targetRadius,
        hardware: sharedConfig.hardware,
        ellipseWidth: sharedConfig.hardware.estimatedAngleError,
        ellipseHeight: sharedConfig.hardware.estimatedVelocityError, 
        targetAxis: sharedConfig.target.targetAxis,
        minHitAngle: sharedConfig.target.minHitAngle,
        maxHitAngle: sharedConfig.target.maxHitAngle,
        physicalValues: {
          ...sharedConfig.hardware,
          ...sharedConfig.aerodynamics,
        },
        costConfig: sharedConfig.cost,
        obstacles: sharedConfig.obstacles, 
      },
    };

    const now = Date.now();
    const COOLDOWN_MS = 150;

    if (now - lastSendTime.current > COOLDOWN_MS) {
      sendMessage(payload, true);
      lastSendTime.current = now;
      if (sendTimeout.current) clearTimeout(sendTimeout.current);
    } else {
      if (sendTimeout.current) clearTimeout(sendTimeout.current);
      sendTimeout.current = setTimeout(() => {
        sendMessage(payload, true);
        lastSendTime.current = Date.now();
      }, COOLDOWN_MS - (now - lastSendTime.current));
    }
  }, [isConnected, sharedConfig, sendMessage, initialX]);

  const resetView = () => {
    setZoom(DEFAULT_ZOOM);
    setPan(DEFAULT_PAN);
  };

  const trajectories: TrajectoryCouple[] = results.trajectories ? results.trajectories : [];

  console.log(results.velocityGapData);

  return (
    <div className="sweep-view" style={{ display: "flex", gap: "20px" }}>
      <div className="charts-area" style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
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
        
        <div className="view-panel" style={{ border: "1px solid #2a2a35", borderRadius: "8px", overflow: "hidden", minHeight: "400px" }}>
          <h3 style={{ margin: "15px", color: "#fff", fontSize: "1rem" }}>Trajectory Boundaries</h3>
          <TrajectoryCanvas
            initialX={initialX}
            setInitialX={setInitialX}
            sharedConfig={sharedConfig}
            updateConfig={updateConfig}
            trajectoryGroups={[
              { 
                trajectories: trajectories.map(couple => couple.closeTrajectory), 
                color: "rgba(0, 255, 136, 0.6)", 
                lineWidth: 1.5,
              },
              { 
                trajectories: trajectories.map(couple => couple.farTrajectory), 
                color: "rgba(255, 68, 68, 0.6)", 
                lineWidth: 1.5
              },  
              { 
                trajectories: results.bestTrajectory ? [results.bestTrajectory] : [], 
                color: "rgba(68, 136, 255, 0.6)", 
                lineWidth: 3,
              },  
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
              bestAngle={parseVelocityVector(results.bestTrajectory?.initialShootingVelocity).angle}
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
            closeTrajectories={trajectories.map(couple => couple.closeTrajectory)}
            farTrajectories={trajectories.map(couple => couple.farTrajectory)}
            bestTrajectory={results.bestTrajectory}
            hardwareConfig={sharedConfig.hardware}
            customGraphs={[
              {
                name: "Velocity Gap",
                data: results.velocityGapData,
                unit: "m/s",
                color: "#00bcd4"
              },
              {
                name: "Gap Derivative",
                data: results.gapDerivativeData,
                unit: "m/s per °",
                color: "#ff9800"
              }
            ]}
          />
        </div>

      </div>

      <TrajectorySidebar
        bestTrajectory={results.bestTrajectory}
        amountOfTrajectories={trajectories.length}
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