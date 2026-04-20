import React, { useEffect, useRef, useState } from "react";
import RobustnessChart from "./RobustnessChart";
import { type Translation2d } from "./util";

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
}

interface TrajectoryVisualizerProps {
  isConnected: boolean;
  results: SimulationResults;
  sendMessage: (payload: any, showTime?: boolean) => void;
}

export default function TrajectoryVisualizer({
  isConnected,
  results,
  sendMessage,
}: TrajectoryVisualizerProps) {
  // --- Simulation Parameters ---
  const [initialX, setInitialX] = useState<number>(0.0);
  const [initialY, setInitialY] = useState<number>(0.0);
  const [targetX, setTargetX] = useState<number>(8.0);
  const [targetY, setTargetY] = useState<number>(2.0);
  const [tolX, setTolX] = useState<number>(0.03);
  const [tolY, setTolY] = useState<number>(0.01);
  const [minAngle, setMinAngle] = useState<number>(50);
  const [maxAngle, setMaxAngle] = useState<number>(80);
  const [minVel, setMinVel] = useState<number>(6);
  const [maxVel, setMaxVel] = useState<number>(12);
  const [minHitAngle, setMinHitAngle] = useState<number>(-90);
  const [maxHitAngle, setMaxHitAngle] = useState<number>(-30);

  // --- Error Estimations ---
  const [estimatedAngleError, setEstimatedAngleError] = useState<number>(0.5);
  const [estimatedVelocityError, setEstimatedVelocityError] = useState<number>(0.08);

  // --- Aerodynamic Parameters ---
  const [mass, setMass] = useState<number>(0.22); // kg
  const [diameter, setDiameter] = useState<number>(0.075); // meters
  const [dragCoeff, setDragCoeff] = useState<number>(0.5);
  const [spinRPS, setSpinRPS] = useState<number>(1); // Positive = Backspin, Negative = Topspin
  const [magnusCoeff, setMagnusCoeff] = useState<number>(0.5); // Tuning variable (similar to lift coefficient slope)

  // --- Locks ---
  const [isLockedOriginX, setIsLockedOriginX] = useState<boolean>(false);
  const [isLockedOriginY, setIsLockedOriginY] = useState<boolean>(false);
  const [isLockedX, setIsLockedX] = useState<boolean>(false);
  const [isLockedY, setIsLockedY] = useState<boolean>(false);

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

  // Interaction Trackers
  const dragOffset = useRef<Translation2d>({ x: 0, y: 0 });
  const clickStartPos = useRef<Translation2d>({ x: 0, y: 0 });

  // Throttle Trackers
  const lastSendTime = useRef<number>(0);
  const sendTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Throttled Calculation Sender ---
  useEffect(() => {
    if (!isConnected) return;

    const payload = {
      type: "calculate",
      data: {
        initialX,
        initialY,
        targetX,
        targetY,
        tolX,
        tolY,
        minHitAngle,
        maxHitAngle,
        physicalValues: {
          minAngle,
          maxAngle,
          minVel,
          maxVel,
          estimatedAngleError,
          estimatedVelocityError,
          mass,
          diameter,
          dragCoeff,
          spinRPS,
          magnusCoeff,
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
  }, [
    isConnected,
    initialX,
    initialY,
    targetX,
    targetY,
    tolX,
    tolY,
    minAngle,
    maxAngle,
    minVel,
    maxVel,
    minHitAngle,
    maxHitAngle,
    estimatedAngleError,
    estimatedVelocityError,
  ]);

  // --- Coordinate Conversions ---
  const toScreen = (mX: number, mY: number, canvasHeight: number) => ({
    x: mX * zoom + pan.x,
    y: canvasHeight - (mY * zoom + pan.y),
  });

  const toWorld = (pX: number, pY: number, canvasHeight: number) => ({
    x: (pX - pan.x) / zoom,
    y: (canvasHeight - pY - pan.y) / zoom,
  });

  const getMouseCoords = (
    e: React.MouseEvent | React.WheelEvent,
    canvas: HTMLCanvasElement,
  ) => {
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

  // --- Mouse Event Handlers ---
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
    const hitTol = Math.max(0.5, 10 / zoom); // Approx 10px interaction radius
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
      dragOffset.current = {
        x: targetX - worldCoords.x,
        y: targetY - worldCoords.y,
      };
    } else if (isOriginHoveredFunc(worldCoords)) {
      setIsDraggingOrigin(true);
      dragOffset.current = {
        x: initialX - worldCoords.x,
        y: initialY - worldCoords.y,
      };
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
      if (!isLockedX)
        setTargetX(Number((worldCoords.x + dragOffset.current.x).toFixed(2)));
      if (!isLockedY)
        setTargetY(
          Math.max(
            0,
            Number((worldCoords.y + dragOffset.current.y).toFixed(2)),
          ),
        );
    } else if (isDraggingOrigin) {
      if (!isLockedOriginX)
        setInitialX(Number((worldCoords.x + dragOffset.current.x).toFixed(2)));
      if (!isLockedOriginY)
        setInitialY(
          Math.max(
            0,
            Number((worldCoords.y + dragOffset.current.y).toFixed(2)),
          ),
        );
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

      // If clicked without dragging
      if (dragDistance < 5) {
        const worldCoords = toWorld(mouseX, mouseY, canvas.height);
        if (isHoveringOrigin && !isDraggingTarget) {
          // Allow origin teleporting on click if hovered roughly over origin area
          if (!isLockedOriginX) setInitialX(Number(worldCoords.x.toFixed(2)));
          if (!isLockedOriginY)
            setInitialY(Math.max(0, Number(worldCoords.y.toFixed(2))));
        } else if (!isDraggingOrigin && !isDraggingTarget) {
          if (!isLockedX) setTargetX(Number(worldCoords.x.toFixed(2)));
          if (!isLockedY)
            setTargetY(Math.max(0, Number(worldCoords.y.toFixed(2))));
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

    // Check if the physical screen size changed
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      // Update the internal drawing buffer to perfectly match the CSS size
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111115";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Dynamic Grid
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

      // Draw thicker line for Ground (Y=0)
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

    // Draw Origin (Launcher Position)
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
    ctx.shadowBlur = 0; // Reset shadow

    ctx.fillStyle = "#888";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText(
      `Launcher (${initialX.toFixed(1)}, ${initialY.toFixed(1)})`,
      originScreen.x + 12,
      originScreen.y + 4,
    );

    // Draw Target Box
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
    ctx.fillStyle =
      isHoveringTarget || isDraggingTarget
        ? isFullyLocked
          ? "rgba(255, 150, 0, 0.4)"
          : "rgba(255, 68, 68, 0.4)"
        : isFullyLocked
          ? "rgba(255, 150, 0, 0.15)"
          : "rgba(255, 68, 68, 0.15)";
    ctx.strokeStyle = isFullyLocked ? "#ff9900" : "#ff4444";

    ctx.lineWidth = isHoveringTarget || isDraggingTarget ? 3 : 2;
    ctx.fillRect(tl.x, tl.y, boxWidth, boxHeight);
    ctx.strokeRect(tl.x, tl.y, boxWidth, boxHeight);

    ctx.shadowBlur = 0; // Reset shadow

    // Draw All Trajectories
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

    // Draw Best Trajectory
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
  }, [
    initialX,
    initialY,
    targetX,
    targetY,
    tolX,
    tolY,
    results,
    zoom,
    pan,
    isHoveringTarget,
    isDraggingTarget,
    isLockedX,
    isLockedY,
    isHoveringOrigin,
    isDraggingOrigin,
  ]);

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
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        fontFamily: "system-ui, sans-serif",
        background: "#0a0a0c",
        color: "#e0e0e0",
      }}
    >
      {/* Main Content Area (Canvas + Graph) */}
      <div className="charts-area">
        {/* Top Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div className="status-indicator">
            <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
            <span className="status-text">
              {isConnected ? 'Solver Linked' : 'Awaiting Connection...'}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <span style={{ fontSize: "0.9rem", color: "#888" }}>
              Scroll: Zoom • Drag: Pan • Click/Drag: Target/Origin
            </span>
            <button
              onClick={resetView}
              style={{
                background: "#2a2a35",
                border: "none",
                color: "#fff",
                padding: "6px 12px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: "bold",
              }}
            >
              Reset View
            </button>
          </div>
        </div>

        {/* Canvas Section */}
        <div
          className="view-panel"
          style={{ padding: 0, overflow: "hidden", minHeight: "600px" }}
        >
          <canvas
            ref={canvasRef}
            width={1200}
            height={600}
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

        {/* Robustness Chart Section */}
        <div className="view-panel">
          <h3 style={{ margin: "0 0 10px 0", fontSize: "1rem", color: "#fff" }}>
            Trajectory Robustness
          </h3>
          <RobustnessChart
            data={results.robustnessData}
            bestAngle={results.bestInfo?.angle}
            minAngle={minAngle}
            maxAngle={maxAngle}
          />
        </div>
      </div>

      {/* Settings Sidebar */}
      <div
        style={{
          width: "400px",
          flexShrink: 0,
          background: "#141418",
          borderLeft: "1px solid #222",
          padding: "20px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <h2 style={{ margin: "0 0 10px 0", fontSize: "1.4rem" }}>
          Configuration
        </h2>

        {/* Results Panel */}
        <div
          style={{
            background: "rgba(0, 255, 136, 0.05)",
            padding: "15px",
            borderRadius: "8px",
            borderLeft: "4px solid #00ff88",
          }}
        >
          <h3
            style={{
              color: "#00ff88",
              margin: "0 0 10px 0",
              fontSize: "1.1rem",
            }}
          >
            Optimal Solution
          </h3>
          {results.bestInfo ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
              }}
            >
              <div>
                <span style={{ color: "#888", fontSize: "0.9rem" }}>
                  Pitch Angle
                </span>
                <br />
                <strong style={{ fontSize: "1.2rem" }}>
                  {results.bestInfo.angle.toFixed(4)}°
                </strong>
              </div>
              <div>
                <span style={{ color: "#888", fontSize: "0.9rem" }}>
                  Velocity
                </span>
                <br />
                <strong style={{ fontSize: "1.2rem" }}>
                  {results.bestInfo.velocity.toFixed(2)} m/s
                </strong>
              </div>
              <div
                style={{
                  gridColumn: "span 2",
                  fontSize: "0.85rem",
                  color: "#aaa",
                  marginTop: "5px",
                }}
              >
                Selected from {results.trajectories.length} viable paths.
              </div>
            </div>
          ) : (
            <div style={{ color: "#ff4444", fontSize: "0.95rem" }}>
              Constraints exceeded. No valid paths found.
            </div>
          )}
        </div>

        {/* Aerodynamics Constraints */}
        <div
          style={{
            background: "#1c1c22",
            padding: "15px",
            borderRadius: "8px",
            border: "1px solid #2a2a35",
            marginTop: "15px",
          }}
        >
          <h3
            style={{ margin: "0 0 15px 0", fontSize: "1.1rem", color: "#fff" }}
          >
            Aerodynamics
          </h3>
          <div style={{ display: "flex", gap: "15px" }}>
            <ControlSlider
              label="Mass"
              value={mass}
              min={0.05}
              max={1.0}
              step={0.01}
              unit="kg"
              onChange={setMass}
            />
            <ControlSlider
              label="Diameter"
              value={diameter}
              min={0.02}
              max={0.3}
              step={0.005}
              unit="m"
              onChange={setDiameter}
            />
          </div>
          <ControlSlider
            label="Drag Coeff"
            value={dragCoeff}
            min={0.1}
            max={1}
            step={0.01}
            unit=" Cd"
            onChange={setDragCoeff}
          />
          <div
            style={{
              display: "flex",
              gap: "15px",
              marginTop: "12px",
              paddingTop: "12px",
              borderTop: "1px solid #333",
            }}
          >
            <ControlSlider
              label="Spin (RPS)"
              value={spinRPS}
              min={-2}
              max={2}
              step={0.1}
              unit=" rps"
              onChange={setSpinRPS}
            />
            <ControlSlider
              label="Magnus Coeff"
              value={magnusCoeff}
              min={0.0}
              max={1.0}
              step={0.01}
              unit=" Cm"
              onChange={setMagnusCoeff}
            />
          </div>
        </div>

        {/* Physical Values */}
        <div
          style={{
            background: "#1c1c22",
            padding: "15px",
            borderRadius: "8px",
            border: "1px solid #2a2a35",
          }}
        >
          <h3
            style={{ margin: "0 0 15px 0", fontSize: "1.1rem", color: "#fff" }}
          >
            Physical Values
          </h3>
          <div style={{ display: "flex", gap: "15px" }}>
            <ControlSlider
              label="Min Angle"
              value={minAngle}
              min={20}
              max={maxAngle}
              step={1}
              unit="°"
              onChange={setMinAngle}
            />
            <ControlSlider
              label="Max Angle"
              value={maxAngle}
              min={minAngle}
              max={85}
              step={1}
              unit="°"
              onChange={setMaxAngle}
            />
          </div>
          <div style={{ display: "flex", gap: "15px" }}>
            <ControlSlider
              label="Min Vel"
              value={minVel}
              min={0}
              max={maxVel}
              step={0.5}
              unit="m/s"
              onChange={setMinVel}
            />
            <ControlSlider
              label="Max Vel"
              value={maxVel}
              min={minVel}
              max={20}
              step={0.5}
              unit="m/s"
              onChange={setMaxVel}
            />
          </div>
          <div
            style={{
              borderTop: "1px solid #333",
              margin: "15px 0",
              paddingTop: "15px",
            }}
          >
            <div style={{ display: "flex", gap: "15px" }}>
              <ControlSlider
                label="Angle Error"
                value={estimatedAngleError}
                min={0}
                max={1}
                step={0.02}
                unit="°"
                onChange={setEstimatedAngleError}
              />
              <ControlSlider
                label="Velocity Error"
                value={estimatedVelocityError}
                min={0}
                max={0.5}
                step={0.01}
                unit="m/s"
                onChange={setEstimatedVelocityError}
              />
            </div>
          </div>
        </div>

        {/* Target Parameters */}
        <div
          style={{
            background: "#1c1c22",
            padding: "15px",
            borderRadius: "8px",
            border: "1px solid #2a2a35",
          }}
        >
          <h3
            style={{ margin: "0 0 15px 0", fontSize: "1.1rem", color: "#fff" }}
          >
            Target Bounds
          </h3>

          {/* Target Axis Locks */}
          <div
            style={{
              display: "flex",
              gap: "10px",
              marginBottom: "15px",
              background: "#25252d",
              padding: "8px",
              borderRadius: "6px",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "0.85rem", color: "#aaa", flex: 1 }}>
              Lock Axis:
            </span>
            <button
              onClick={() => setIsLockedX(!isLockedX)}
              style={{
                flex: 1.5,
                background: isLockedX ? "rgba(255, 153, 0, 0.2)" : "#333",
                border: isLockedX
                  ? "1px solid #ff9900"
                  : "1px solid transparent",
                color: isLockedX ? "#ff9900" : "#fff",
                borderRadius: "4px",
                padding: "6px",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: isLockedX ? "bold" : "normal",
                transition: "all 0.2s",
              }}
            >
              {isLockedX ? "🔒 Locked X" : "🔓 Unlocked X"}
            </button>
            <button
              onClick={() => setIsLockedY(!isLockedY)}
              style={{
                flex: 1.5,
                background: isLockedY ? "rgba(255, 153, 0, 0.2)" : "#333",
                border: isLockedY
                  ? "1px solid #ff9900"
                  : "1px solid transparent",
                color: isLockedY ? "#ff9900" : "#fff",
                borderRadius: "4px",
                padding: "6px",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: isLockedY ? "bold" : "normal",
                transition: "all 0.2s",
              }}
            >
              {isLockedY ? "🔒 Locked Y" : "🔓 Unlocked Y"}
            </button>
          </div>

          <ControlSlider
            label="Distance (X)"
            value={targetX}
            min={1}
            max={18}
            step={0.1}
            unit="m"
            disabled={isLockedX}
            onChange={setTargetX}
          />
          <ControlSlider
            label="Height (Y)"
            value={targetY}
            min={0}
            max={10}
            step={0.1}
            unit="m"
            disabled={isLockedY}
            onChange={setTargetY}
          />
          <div style={{ display: "flex", gap: "15px" }}>
            <ControlSlider
              label="Tolerance X"
              value={tolX}
              min={0.01}
              max={0.2}
              step={0.01}
              unit="m"
              onChange={setTolX}
            />
            <ControlSlider
              label="Tolerance Y"
              value={tolY}
              min={0.01}
              max={0.2}
              step={0.01}
              unit="m"
              onChange={setTolY}
            />
          </div>
          <div style={{ display: "flex", gap: "15px" }}>
            <ControlSlider
              label="Min Hit Angle"
              value={minHitAngle}
              min={-90}
              max={maxHitAngle}
              step={1}
              unit="°"
              onChange={setMinHitAngle}
            />
            <ControlSlider
              label="Max Hit Angle"
              value={maxHitAngle}
              min={minHitAngle}
              max={90}
              step={1}
              unit="°"
              onChange={setMaxHitAngle}
            />
          </div>
        </div>

        {/* Origin Parameters */}
        <div
          style={{
            background: "#1c1c22",
            padding: "15px",
            borderRadius: "8px",
            border: "1px solid #2a2a35",
          }}
        >
          <h3
            style={{ margin: "0 0 15px 0", fontSize: "1.1rem", color: "#fff" }}
          >
            Initial Position (Launcher)
          </h3>

          <div
            style={{
              display: "flex",
              gap: "10px",
              marginBottom: "15px",
              background: "#25252d",
              padding: "8px",
              borderRadius: "6px",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "0.85rem", color: "#aaa", flex: 1 }}>
              Lock Axis:
            </span>
            <button
              onClick={() => setIsLockedOriginX(!isLockedOriginX)}
              style={{
                flex: 1.5,
                background: isLockedOriginX
                  ? "rgba(68, 136, 255, 0.2)"
                  : "#333",
                border: isLockedOriginX
                  ? "1px solid #4488ff"
                  : "1px solid transparent",
                color: isLockedOriginX ? "#4488ff" : "#fff",
                borderRadius: "4px",
                padding: "6px",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: isLockedOriginX ? "bold" : "normal",
                transition: "all 0.2s",
              }}
            >
              {isLockedOriginX ? "🔒 Locked X" : "🔓 Unlocked X"}
            </button>
            <button
              onClick={() => setIsLockedOriginY(!isLockedOriginY)}
              style={{
                flex: 1.5,
                background: isLockedOriginY
                  ? "rgba(68, 136, 255, 0.2)"
                  : "#333",
                border: isLockedOriginY
                  ? "1px solid #4488ff"
                  : "1px solid transparent",
                color: isLockedOriginY ? "#4488ff" : "#fff",
                borderRadius: "4px",
                padding: "6px",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: isLockedOriginY ? "bold" : "normal",
                transition: "all 0.2s",
              }}
            >
              {isLockedOriginY ? "🔒 Locked Y" : "🔓 Unlocked Y"}
            </button>
          </div>

          <ControlSlider
            label="Position (X)"
            value={initialX}
            min={-10}
            max={10}
            step={0.1}
            unit="m"
            disabled={isLockedOriginX}
            onChange={setInitialX}
          />
          <ControlSlider
            label="Height (Y)"
            value={initialY}
            min={0}
            max={10}
            step={0.1}
            unit="m"
            disabled={isLockedOriginY}
            onChange={setInitialY}
          />
        </div>
      </div>
    </div>
  );
}

// --- Reusable UI Sub-Component ---
interface ControlSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (val: number) => void;
  disabled?: boolean; // <-- Added this
}

function ControlSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  disabled = false,
}: ControlSliderProps) {
  return (
    <div className={`slider-wrapper ${disabled ? "disabled" : ""}`}>
      <div className="slider-header">
        <span>{label}</span>
        <span className="slider-value">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled} // <-- Passed to the HTML input
      />
    </div>
  );
}
