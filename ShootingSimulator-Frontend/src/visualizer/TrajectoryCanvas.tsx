import React, { useEffect, useRef, useState } from "react";
import type { SharedConfig, SimulationResults, Translation2d } from "../types";

interface CanvasProps {
  targetX: number;
  setTargetX: (val: number) => void;
  sharedConfig: SharedConfig;
  updateConfig: <K extends keyof SharedConfig>(section: K, updates: Partial<SharedConfig[K]>) => void;
  results: SimulationResults;
  zoom: number;
  setZoom: (val: number) => void;
  pan: Translation2d;
  setPan: React.Dispatch<React.SetStateAction<Translation2d>>;
  isLockedX: boolean;
  isLockedY: boolean;
  isLockedOriginX: boolean;
  isLockedOriginY: boolean;
}

export default function TrajectoryCanvas({
  targetX, setTargetX, sharedConfig, updateConfig, results,
  zoom, setZoom, pan, setPan,
  isLockedX, isLockedY, isLockedOriginX, isLockedOriginY
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Interaction State
  const [isDraggingTarget, setIsDraggingTarget] = useState(false);
  const [isDraggingOrigin, setIsDraggingOrigin] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isHoveringTarget, setIsHoveringTarget] = useState(false);
  const [isHoveringOrigin, setIsHoveringOrigin] = useState(false);

  const lastMouse = useRef<Translation2d>({ x: 0, y: 0 });
  const dragOffset = useRef<Translation2d>({ x: 0, y: 0 });
  const clickStartPos = useRef<Translation2d>({ x: 0, y: 0 });

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const preventScroll = (e: WheelEvent) => e.preventDefault();
    canvas.addEventListener("wheel", preventScroll, { passive: false });
    return () => canvas.removeEventListener("wheel", preventScroll);
  }, []);

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

  // Euclidean distance for circular hitboxes
  const isHoveringDot = (worldCoords: Translation2d, dotX: number, dotY: number) => {
    const hitRadius = Math.max(0.5, 10 / zoom);
    const dx = worldCoords.x - dotX;
    const dy = worldCoords.y - dotY;
    return Math.sqrt(dx * dx + dy * dy) <= hitRadius;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x: mouseX, y: mouseY } = getMouseCoords(e, canvas);
    clickStartPos.current = { x: mouseX, y: mouseY };
    const worldCoords = toWorld(mouseX, mouseY, canvas.height);

    if (isHoveringDot(worldCoords, targetX, sharedConfig.target.targetY)) {
      setIsDraggingTarget(true);
      dragOffset.current = {
        x: targetX - worldCoords.x,
        y: sharedConfig.target.targetY - worldCoords.y,
      };
    } else if (isHoveringDot(worldCoords, sharedConfig.origin.initialX, sharedConfig.origin.initialY)) {
      setIsDraggingOrigin(true);
      dragOffset.current = {
        x: sharedConfig.origin.initialX - worldCoords.x,
        y: sharedConfig.origin.initialY - worldCoords.y,
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

    setIsHoveringTarget(isHoveringDot(worldCoords, targetX, sharedConfig.target.targetY));
    setIsHoveringOrigin(isHoveringDot(worldCoords, sharedConfig.origin.initialX, sharedConfig.origin.initialY));

    if (isDraggingTarget) {
      if (!isLockedX)
        setTargetX(Number((worldCoords.x + dragOffset.current.x).toFixed(2)));

      const newY = !isLockedY
        ? Math.max(0, Number((worldCoords.y + dragOffset.current.y).toFixed(2)))
        : sharedConfig.target.targetY;
      if (newY !== sharedConfig.target.targetY) {
        updateConfig("target", { targetY: newY });
      }
    } else if (isDraggingOrigin) {
      const newX = !isLockedOriginX
        ? Number((worldCoords.x + dragOffset.current.x).toFixed(2))
        : sharedConfig.origin.initialX;
      const newY = !isLockedOriginY
        ? Math.max(0, Number((worldCoords.y + dragOffset.current.y).toFixed(2)))
        : sharedConfig.origin.initialY;

      if (newX !== sharedConfig.origin.initialX || newY !== sharedConfig.origin.initialY) {
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
          const newX = !isLockedOriginX ? Number(worldCoords.x.toFixed(2)) : sharedConfig.origin.initialX;
          const newY = !isLockedOriginY ? Math.max(0, Number(worldCoords.y.toFixed(2))) : sharedConfig.origin.initialY;
          updateConfig("origin", { initialX: newX, initialY: newY });
        } else if (!isDraggingOrigin && !isDraggingTarget) {
          if (!isLockedX) setTargetX(Number(worldCoords.x.toFixed(2)));
          const newY = !isLockedY ? Math.max(0, Number(worldCoords.y.toFixed(2))) : sharedConfig.target.targetY;
          updateConfig("target", { targetY: newY });
        }
      }
    }
    setIsDraggingTarget(false);
    setIsDraggingOrigin(false);
    setIsPanning(false);
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

    // Draw Grid
    const startX = Math.floor((0 - pan.x) / zoom);
    const endX = Math.ceil((canvas.width - pan.x) / zoom);
    for (let i = startX; i <= endX; i++) {
      const px = i * zoom + pan.x;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, canvas.height); ctx.stroke();
    }

    const startY = Math.floor(-pan.y / zoom);
    const endY = Math.ceil((canvas.height - pan.y) / zoom);
    for (let i = startY; i <= endY; i++) {
      const py = canvas.height - (i * zoom + pan.y);
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(canvas.width, py); ctx.stroke();
      if (i === 0) {
        ctx.save(); ctx.strokeStyle = "#555"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(canvas.width, py); ctx.stroke();
        ctx.restore();
      }
    }

    // Draw Origin
    const originScreen = toScreen(sharedConfig.origin.initialX, sharedConfig.origin.initialY, canvas.height);
    if (isHoveringOrigin || isDraggingOrigin) {
      ctx.shadowColor = "rgba(68, 136, 255, 0.6)";
      ctx.shadowBlur = 15;
    }
    ctx.fillStyle = "#4488ff";
    ctx.beginPath(); ctx.arc(originScreen.x, originScreen.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#888";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText(`Launcher (${sharedConfig.origin.initialX.toFixed(1)}, ${sharedConfig.origin.initialY.toFixed(1)})`, originScreen.x + 12, originScreen.y + 4);

    // Draw Target Dot
    const targetScreen = toScreen(targetX, sharedConfig.target.targetY, canvas.height);
    const isTargetLocked = isLockedX && isLockedY;

    if (isHoveringTarget || isDraggingTarget) {
      ctx.shadowColor = isTargetLocked ? "rgba(255, 153, 0, 0.8)" : "rgba(255, 68, 68, 0.8)";
      ctx.shadowBlur = 15;
    }

    ctx.fillStyle = isTargetLocked ? "#ff9900" : "#ff4444";
    ctx.beginPath(); ctx.arc(targetScreen.x, targetScreen.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#888";
    ctx.fillText(`Target (${targetX.toFixed(1)}, ${sharedConfig.target.targetY.toFixed(1)})`, targetScreen.x + 12, targetScreen.y + 4);

    // Draw Trajectories
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
  }, [sharedConfig.origin.initialX, sharedConfig.origin.initialY, targetX, sharedConfig.target.targetY, results, zoom, pan, isHoveringTarget, isDraggingTarget, isLockedX, isLockedY, isHoveringOrigin, isDraggingOrigin]);

  // Dynamic Cursor
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
    cursorStyle = (isLockedX && isLockedY) ? "not-allowed" : "grab";
  } else if (isHoveringOrigin) {
    cursorStyle = (isLockedOriginX && isLockedOriginY) ? "not-allowed" : "grab";
  } else if (isPanning) {
    cursorStyle = "move";
  }

  return (
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
  );
}