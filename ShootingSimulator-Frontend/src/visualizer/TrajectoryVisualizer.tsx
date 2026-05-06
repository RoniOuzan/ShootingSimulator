import React, { useEffect, useRef, useState } from "react";
import { type Translation2d } from "../util";
import RobustnessChart from "./RobustnessChart";
import CostChart from "./CostChart";
import ControlSlider from "../components/ControlSlider";
import { usePersistedState } from "../hooks/usePersistedState";
import type { SharedConfig } from "../types";

// --- Interfaces ---
interface Sample {
  position: Translation2d;
  velocity: Translation2d;
}

interface Trajectory {
  samples: Sample[];
}

export interface SimulationResults {
  trajectories: Trajectory[];
  bestTrajectory: Trajectory | null;
  bestInfo: { angle: number; velocity: number } | null;
  robustnessData: any[];
  costData: any[];
}

interface Props {
  isConnected: boolean;
  results: SimulationResults;
  sendMessage: (payload: any, showTime?: boolean) => void;
  sharedConfig: SharedConfig;
  updateConfig: <K extends keyof SharedConfig>(section: K, updates: Partial<SharedConfig[K]>) => void;
}

export default function TrajectoryVisualizer({
  isConnected,
  results,
  sendMessage,
  sharedConfig,
  updateConfig,
}: Props) {
  // --- Destructure Shared Config (InitialX included here now) ---
  const { targetY, tolX, tolY, minHitAngle, maxHitAngle } = sharedConfig.target || { targetY: 2, tolX: 0.03, tolY: 0.01, minHitAngle: 0, maxHitAngle: 90 };
  const { initialX, initialY, radialVelocity } = sharedConfig.origin || { initialX: 0, initialY: 0, radialVelocity: 0 };
  const hardware = sharedConfig.hardware || { minAngle: 10, maxAngle: 60, minVel: 6, maxVel: 12, estimatedAngleError: 0.005, estimatedVelocityError: 0.0008 };
  const aero = sharedConfig.aerodynamics || { mass: 0.22, diameter: 0.075, dragCoeff: 0.5, spinRPSPerMS: 1, magnusCoeff: 0.5 };

  // --- Tab-Specific State with Persistence (TargetX & Locks only) ---
  const [targetX, setTargetX] = usePersistedState("traj_targetX", 3.0);
  
  const [isLockedOriginX, setIsLockedOriginX] = usePersistedState("traj_lockOriginX", false);
  const [isLockedOriginY, setIsLockedOriginY] = usePersistedState("traj_lockOriginY", false);
  const [isLockedX, setIsLockedX] = usePersistedState("traj_lockX", false);
  const [isLockedY, setIsLockedY] = usePersistedState("traj_lockY", false);

  // --- Viewport & Interaction State ---
  const DEFAULT_ZOOM = 80;
  const DEFAULT_PAN = { x: 350, y: 50 };

  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);
  const [pan, setPan] = useState<Translation2d>(DEFAULT_PAN);
  const [isDraggingTarget, setIsDraggingTarget] = useState(false);
  const [isDraggingOrigin, setIsDraggingOrigin] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isHoveringTarget, setIsHoveringTarget] = useState(false);
  const [isHoveringOrigin, setIsHoveringOrigin] = useState(false);

  // --- Refs ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastMouse = useRef<Translation2d>({ x: 0, y: 0 });
  const dragOffset = useRef<Translation2d>({ x: 0, y: 0 });
  const clickStartPos = useRef<Translation2d>({ x: 0, y: 0 });
  const lastSendTime = useRef<number>(0);
  const sendTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Throttled Calculation Sender ---
  useEffect(() => {
    if (!isConnected) return;

    const payload = {
      type: "calculate",
      data: {
        targetMode: sharedConfig.targetMode,
        initialX,
        initialY,
        radialVelocity,
        targetX,
        targetY,
        tolX,
        tolY,
        minHitAngle,
        maxHitAngle,
        physicalValues: {
          ...hardware,
          ...aero,
        },
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
  }, [isConnected, sharedConfig, targetX, sendMessage]); 

  // --- Coordinate Conversions ---
  const toScreen = (mX: number, mY: number, canvasHeight: number) => ({
    x: mX * zoom + pan.x,
    y: canvasHeight - (mY * zoom + pan.y),
  });

  const toWorld = (pX: number, pY: number, canvasHeight: number) => ({
    x: (pX - pan.x) / zoom,
    y: (canvasHeight - pY - pan.y) / zoom,
  });

  const getMouseCoords = (e: React.MouseEvent | React.WheelEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // --- Prevent Native Scroll on Canvas Hover ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const preventScroll = (e: WheelEvent) => e.preventDefault();
    canvas.addEventListener("wheel", preventScroll, { passive: false });
    return () => canvas.removeEventListener("wheel", preventScroll);
  }, []);

  // --- Interaction Handlers ---
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const zoomSensitivity = 0.002;
    const delta = -e.deltaY * zoomSensitivity;
    let newZoom = zoom * Math.exp(delta);
    newZoom = Math.max(20, Math.min(newZoom, 1000000));

    const { x: mouseX, y: mouseY } = getMouseCoords(e, canvas);
    const worldX = (mouseX - pan.x) / zoom;
    const worldY = (canvas.height - mouseY - pan.y) / zoom;

    setZoom(newZoom);
    setPan({
      x: mouseX - worldX * newZoom,
      y: canvas.height - mouseY - worldY * newZoom,
    });
  };

  const isTargetHoveredFunc = (worldCoords: Translation2d) => {
    const hitTolX = Math.max(tolX, 0.5);
    const hitTolY = Math.max(tolY, 0.5);
    return (
      worldCoords.x >= targetX - hitTolX &&
      worldCoords.x <= targetX + hitTolX &&
      worldCoords.y >= targetY - hitTolY &&
      worldCoords.y <= targetY + hitTolY
    );
  };

  const isOriginHoveredFunc = (worldCoords: Translation2d) => {
    const hitTol = Math.max(0.5, 10 / zoom);
    return (
      worldCoords.x >= initialX - hitTol &&
      worldCoords.x <= initialX + hitTol &&
      worldCoords.y >= initialY - hitTol &&
      worldCoords.y <= initialY + hitTol
    );
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x: mouseX, y: mouseY } = getMouseCoords(e, canvas);
    clickStartPos.current = { x: mouseX, y: mouseY };
    const worldCoords = toWorld(mouseX, mouseY, canvas.height);

    if (isTargetHoveredFunc(worldCoords)) {
      setIsDraggingTarget(true);
      dragOffset.current = { x: targetX - worldCoords.x, y: targetY - worldCoords.y };
    } else if (isOriginHoveredFunc(worldCoords)) {
      setIsDraggingOrigin(true);
      dragOffset.current = { x: initialX - worldCoords.x, y: initialY - worldCoords.y };
    } else {
      setIsPanning(true);
    }
    lastMouse.current = { x: mouseX, y: mouseY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x: mouseX, y: mouseY } = getMouseCoords(e, canvas);
    const worldCoords = toWorld(mouseX, mouseY, canvas.height);

    setIsHoveringTarget(isTargetHoveredFunc(worldCoords));
    setIsHoveringOrigin(isOriginHoveredFunc(worldCoords));

    if (isDraggingTarget) {
      if (!isLockedX) setTargetX(Number((worldCoords.x + dragOffset.current.x).toFixed(2)));
      
      const newY = !isLockedY ? Math.max(0, Number((worldCoords.y + dragOffset.current.y).toFixed(2))) : targetY;
      if (newY !== targetY) {
        updateConfig("target", { targetY: newY });
      }
    } else if (isDraggingOrigin) {
      const newX = !isLockedOriginX ? Number((worldCoords.x + dragOffset.current.x).toFixed(2)) : initialX;
      const newY = !isLockedOriginY ? Math.max(0, Number((worldCoords.y + dragOffset.current.y).toFixed(2))) : initialY;

      if (newX !== initialX || newY !== initialY) {
        updateConfig("origin", { initialX: newX, initialY: newY });
      }
    } else if (isPanning) {
      const dx = mouseX - lastMouse.current.x;
      const dy = mouseY - lastMouse.current.y;
      setPan((prev) => ({ x: prev.x + dx, y: prev.y - dy }));
    }

    lastMouse.current = { x: mouseX, y: mouseY };
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const { x: mouseX, y: mouseY } = getMouseCoords(e, canvas);
      const dx = mouseX - clickStartPos.current.x;
      const dy = mouseY - clickStartPos.current.y;
      const dragDistance = Math.sqrt(dx * dx + dy * dy);

      if (dragDistance < 5) {
        const worldCoords = toWorld(mouseX, mouseY, canvas.height);
        if (isHoveringOrigin && !isDraggingTarget) {
          const newX = !isLockedOriginX ? Number(worldCoords.x.toFixed(2)) : initialX;
          const newY = !isLockedOriginY ? Math.max(0, Number(worldCoords.y.toFixed(2))) : initialY;
          // FIXED: 2 arguments
          updateConfig("origin", { initialX: newX, initialY: newY });
        } else if (!isDraggingOrigin && !isDraggingTarget) {
          if (!isLockedX) setTargetX(Number(worldCoords.x.toFixed(2)));
          
          const newY = !isLockedY ? Math.max(0, Number(worldCoords.y.toFixed(2))) : targetY;
          // FIXED: 2 arguments
          updateConfig("target", { targetY: newY });
        }
      }
    }

    setIsDraggingTarget(false);
    setIsDraggingOrigin(false);
    setIsPanning(false);
  };

  const resetView = () => {
    setZoom(DEFAULT_ZOOM);
    setPan(DEFAULT_PAN);
  };

  // --- Canvas Rendering ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111115";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#2a2a35";
    ctx.lineWidth = 1;

    const startX = Math.floor((0 - pan.x) / zoom);
    const endX = Math.ceil((canvas.width - pan.x) / zoom);
    for (let i = startX; i <= endX; i++) {
      const px = i * zoom + pan.x;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, canvas.height);
      ctx.stroke();
    }

    const startY = Math.floor(-pan.y / zoom);
    const endY = Math.ceil((canvas.height - pan.y) / zoom);
    for (let i = startY; i <= endY; i++) {
      const py = canvas.height - (i * zoom + pan.y);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(canvas.width, py);
      ctx.stroke();

      if (i === 0) {
        ctx.save();
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(canvas.width, py);
        ctx.stroke();
        ctx.restore();
      }
    }

    const originScreen = toScreen(initialX, initialY, canvas.height);
    if (isHoveringOrigin || isDraggingOrigin) {
      ctx.shadowColor = "rgba(68, 136, 255, 0.6)";
      ctx.shadowBlur = 15;
    }

    ctx.fillStyle = "#4488ff";
    ctx.beginPath();
    ctx.arc(originScreen.x, originScreen.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#888";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText(`Launcher (${initialX.toFixed(1)}, ${initialY.toFixed(1)})`, originScreen.x + 12, originScreen.y + 4);

    const tl = toScreen(targetX - tolX, targetY + tolY, canvas.height);
    const boxWidth = tolX * 2 * zoom;
    const boxHeight = tolY * 2 * zoom;
    const centerScreen = toScreen(targetX, targetY, canvas.height);

    if (isHoveringTarget || isDraggingTarget) {
      ctx.shadowColor = "rgba(255, 68, 68, 0.6)";
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(centerScreen.x, centerScreen.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#ff4444";
      ctx.fill();
    }

    const isFullyLocked = isLockedX && isLockedY;
    ctx.fillStyle = isHoveringTarget || isDraggingTarget
      ? isFullyLocked ? "rgba(255, 150, 0, 0.4)" : "rgba(255, 68, 68, 0.4)"
      : isFullyLocked ? "rgba(255, 150, 0, 0.15)" : "rgba(255, 68, 68, 0.15)";
    ctx.strokeStyle = isFullyLocked ? "#ff9900" : "#ff4444";

    ctx.lineWidth = isHoveringTarget || isDraggingTarget ? 3 : 2;
    ctx.fillRect(tl.x, tl.y, boxWidth, boxHeight);
    ctx.strokeRect(tl.x, tl.y, boxWidth, boxHeight);
    ctx.shadowBlur = 0;

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(0, 255, 255, 0.1)";
    results.trajectories.forEach((path) => {
      ctx.beginPath();
      path.samples.forEach((p, index) => {
        const px = toScreen(p.position.x, p.position.y, canvas.height);
        if (index === 0) ctx.moveTo(px.x, px.y);
        else ctx.lineTo(px.x, px.y);
      });
      ctx.stroke();
    });

    if (results.bestTrajectory) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#00ff88";
      ctx.beginPath();
      results.bestTrajectory.samples.forEach((p, index) => {
        const px = toScreen(p.position.x, p.position.y, canvas.height);
        if (index === 0) ctx.moveTo(px.x, px.y);
        else ctx.lineTo(px.x, px.y);
      });
      ctx.stroke();
    }
  }, [initialX, initialY, targetX, targetY, tolX, tolY, results, zoom, pan, isHoveringTarget, isDraggingTarget, isLockedX, isLockedY, isHoveringOrigin, isDraggingOrigin]);

  // --- Dynamic Cursor ---
  let cursorStyle = "default";
  if (isDraggingTarget) {
    if (isLockedX && isLockedY) cursorStyle = "not-allowed";
    else if (isLockedX) cursorStyle = "ns-resize";
    else if (isLockedY) cursorStyle = "ew-resize";
    else cursorStyle = "grabbing";
  } else if (isDraggingOrigin) {
    if (isLockedOriginX && isLockedOriginY) cursorStyle = "not-allowed";
    else if (isLockedOriginX) cursorStyle = "ns-resize";
    else if (isLockedOriginY) cursorStyle = "ew-resize";
    else cursorStyle = "grabbing";
  } else if (isHoveringTarget) {
    cursorStyle = isLockedX && isLockedY ? "not-allowed" : "grab";
  } else if (isHoveringOrigin) {
    cursorStyle = isLockedOriginX && isLockedOriginY ? "not-allowed" : "grab";
  } else if (isPanning) {
    cursorStyle = "move";
  }

  return (
    <div className="sweep-view"> {/* Matching the overarching layout class */}
      {/* Charts Area */}
      <div className="charts-area">
        <div className="charts-header">
          <div className="status-indicator">
            <span className={`status-dot ${isConnected ? "connected" : "disconnected"}`}></span>
            <span className="status-text">
              {isConnected ? "Solver Linked" : "Awaiting Connection..."}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <span className="hint">
              Scroll: Zoom • Drag: Pan • Click/Drag: Target/Origin
            </span>
            <button className="calculate-btn" onClick={resetView} style={{ padding: "6px 12px" }}>
              Reset View
            </button>
          </div>
        </div>

        <div className="charts-content">
          <div className="view-panel" style={{ padding: 0, overflow: "hidden", minHeight: "500px", border: "1px solid #2a2a35", borderRadius: "8px" }}>
            <canvas
              ref={canvasRef}
              width={1200}
              height={500}
              style={{
                width: "100%",
                height: "100%",
                display: "block",
                cursor: cursorStyle,
                touchAction: "none",
              }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>

          <div style={{ display: "flex", gap: "20px", marginTop: "20px" }}>
            <div className="view-panel" style={{ flex: 1, border: "1px solid #2a2a35", borderRadius: "8px", padding: "15px" }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: "1rem", color: "#fff" }}>Trajectory Robustness</h3>
              <RobustnessChart
                data={results.robustnessData}
                bestAngle={results.bestInfo?.angle ?? 0}
                minAngle={hardware.minAngle}
                maxAngle={hardware.maxAngle}
              />
            </div>
            <div className="view-panel" style={{ flex: 1, border: "1px solid #2a2a35", borderRadius: "8px", padding: "15px" }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: "1rem", color: "#fff" }}>Trajectory Costs</h3>
              <CostChart
                data={results.costData}
                minAngle={hardware.minAngle}
                maxAngle={hardware.maxAngle}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Settings Sidebar */}
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
            <div style={{ color: "#ff4444", fontSize: "0.95rem" }}>
              Constraints exceeded. No valid paths found.
            </div>
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
                style={{ flex: 1, background: isLockedX ? "rgba(255, 153, 0, 0.2)" : "#333", border: isLockedX ? "1px solid #ff9900" : "1px solid transparent", color: isLockedX ? "#ff9900" : "#fff" }}
              >
                {isLockedX ? "🔒 X" : "🔓 X"}
              </button>
              <button
                onClick={() => setIsLockedY(!isLockedY)}
                className={`calculate-btn ${isLockedY ? "locked" : ""}`}
                style={{ flex: 1, background: isLockedY ? "rgba(255, 153, 0, 0.2)" : "#333", border: isLockedY ? "1px solid #ff9900" : "1px solid transparent", color: isLockedY ? "#ff9900" : "#fff" }}
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
                style={{ flex: 1, background: isLockedOriginX ? "rgba(68, 136, 255, 0.2)" : "#333", border: isLockedOriginX ? "1px solid #4488ff" : "1px solid transparent", color: isLockedOriginX ? "#4488ff" : "#fff" }}
              >
                {isLockedOriginX ? "🔒 X" : "🔓 X"}
              </button>
              <button
                onClick={() => setIsLockedOriginY(!isLockedOriginY)}
                className={`calculate-btn ${isLockedOriginY ? "locked" : ""}`}
                style={{ flex: 1, background: isLockedOriginY ? "rgba(68, 136, 255, 0.2)" : "#333", border: isLockedOriginY ? "1px solid #4488ff" : "1px solid transparent", color: isLockedOriginY ? "#4488ff" : "#fff" }}
              >
                {isLockedOriginY ? "🔒 Y" : "🔓 Y"}
              </button>
            </div>
          </div>
        </div>

        <div className="tab-config-card">
          <h3>Target</h3>
          <ControlSlider
            label="Target X" value={targetX} min={1} max={18} step={0.1} unit="m" disabled={isLockedX}
            onChange={setTargetX}
          />
        </div>
      </div>
    </div>
  );
}