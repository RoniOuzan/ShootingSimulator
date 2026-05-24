import { useEffect, useRef, useState } from "react";
import { usePersistedState } from "../hooks/usePersistedState";
import type { OptimalResults, SharedConfig, Translation2d } from "../types";
import { TrajectoryCanvas } from "../visualizer/TrajectoryCanvas";
import CostChart from "../visualizer/CostChart";
import ToleranceGraph from "./ToleranceGraph";

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
  const [initialX, setInitialX] = usePersistedState("opt_initialX", -4.0);
  
  // Viewport States for the Trajectory Canvas
  const [zoom, setZoom] = useState<number>(100);
  const [pan, setPan] = useState<Translation2d>({ x: 900, y: 50 });

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

  return (
    <div className="sweep-view" style={{ display: "flex", gap: "20px" }}>
      <div className="charts-area" style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* Top Half: The Trajectories (Close, Far, Optimal) */}
        <div className="view-panel" style={{ border: "1px solid #2a2a35", borderRadius: "8px", overflow: "hidden", minHeight: "400px" }}>
           <h3 style={{ margin: "15px", color: "#fff", fontSize: "1rem" }}>Trajectory Boundaries</h3>
           <TrajectoryCanvas
              initialX={initialX}
              setInitialX={setInitialX}
              sharedConfig={sharedConfig}
              updateConfig={updateConfig}
              trajectoryGroups={[
                { 
                  trajectories: results.closeTrajectories, 
                  color: "rgba(0, 255, 136, 0.6)", 
                  lineWidth: 1.5,
                },
                { 
                  trajectories: results.farTrajectories, 
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
              isLockedY={false}
              isLockedOriginX={false}
              isLockedOriginY={false}
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
            maxLimit={1}
          />
        </div>

        {/* Bottom Half: The Velocity vs Angle Tolerance Graph */}
        <div className="view-panel" style={{ border: "1px solid #2a2a35", borderRadius: "8px", padding: "15px", minHeight: "400px" }}>
          <h3 style={{ margin: "0 0 15px 0", color: "#fff", fontSize: "1rem" }}>Tolerance Basin & Ellipse Fit</h3>
          <ToleranceGraph 
            results={results} 
            hardwareConfig={sharedConfig.hardware}
          />
        </div>

      </div>
    </div>
  );
}