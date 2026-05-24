import { useEffect, useRef } from "react";
import type { OptimalResults, SharedConfig } from "../types";

interface Props {
  results: OptimalResults;
  hardwareConfig: SharedConfig["hardware"];
}

interface BasinPoint {
  angle: number;
  minVel?: number;
  maxVel?: number;
}

export default function ToleranceGraph({ results, hardwareConfig }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high-DPI displays for ultra-sharp canvas rendering
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#111115";
    ctx.fillRect(0, 0, width, height);

    // --- Helper: Extract Vector Angle & Magnitude ---
    const parseVelocityVector = (vector: { x: number; y: number }) => {
      if (!vector) return { angle: 0, velocity: 0 };
      const velocity = Math.hypot(vector.x, vector.y);
      const angle = Math.atan2(vector.y, vector.x) * (180 / Math.PI);
      return { angle, velocity };
    };

    // --- Process Trajectory Collections into Graph Points ---
    const dataMap: { [key: string]: BasinPoint } = {};

    results.closeTrajectories?.forEach((t) => {
      const { angle, velocity } = parseVelocityVector(t.initialShootingVelocity);
      const key = angle.toFixed(1);
      if (!dataMap[key]) dataMap[key] = { angle };
      dataMap[key].minVel = velocity;
    });

    results.farTrajectories?.forEach((t) => {
      const { angle, velocity } = parseVelocityVector(t.initialShootingVelocity);
      const key = angle.toFixed(1);
      if (!dataMap[key]) dataMap[key] = { angle };
      dataMap[key].maxVel = velocity;
    });

    // Sort entries sequentially by angle to form continuous curves
    const basinPoints = Object.values(dataMap)
      .filter((p) => p.minVel !== undefined && p.maxVel !== undefined)
      .sort((a, b) => a.angle - b.angle);

    if (basinPoints.length === 0) {
      ctx.fillStyle = "#666";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No overlapping hit windows found for this position.", width / 2, height / 2);
      return;
    }

    // --- Coordinate Bounds Calculation ---
    const angles = basinPoints.map((p) => p.angle);
    const minVelocities = basinPoints.map((p) => p.minVel!);
    const maxVelocities = basinPoints.map((p) => p.maxVel!);

    const minAngleBounds = Math.min(...angles);
    const maxAngleBounds = Math.max(...angles);
    const minVelBounds = Math.min(...minVelocities) - 0.5;
    const maxVelBounds = Math.max(...maxVelocities) + 0.5;

    // Transform world metrics safely to screen coordinate pixels
    const toScreenX = (angle: number) => 
      ((angle - minAngleBounds) / (maxAngleBounds - minAngleBounds)) * (width - 100) + 50;
    const toScreenY = (vel: number) => 
      height - (((vel - minVelBounds) / (maxVelBounds - minVelBounds)) * (height - 60) + 30);

    // 1. Draw Shaded Acceptable Launch Basin
    ctx.beginPath();
    basinPoints.forEach((p) => ctx.lineTo(toScreenX(p.angle), toScreenY(p.maxVel!)));
    for (let i = basinPoints.length - 1; i >= 0; i--) {
      ctx.lineTo(toScreenX(basinPoints[i].angle), toScreenY(basinPoints[i].minVel!));
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.fill();

    // 2. Draw Max Speed Bound (Far Edge - Green)
    ctx.beginPath();
    ctx.strokeStyle = "#44ef44";
    ctx.lineWidth = 2.5;
    basinPoints.forEach((p, i) => {
      if (i === 0) ctx.moveTo(toScreenX(p.angle), toScreenY(p.maxVel!));
      else ctx.lineTo(toScreenX(p.angle), toScreenY(p.maxVel!));
    });
    ctx.stroke();

    // 3. Draw Min Speed Bound (Close Edge - Red)
    ctx.beginPath();
    ctx.strokeStyle = "#ef4444";
    basinPoints.forEach((p, i) => {
      if (i === 0) ctx.moveTo(toScreenX(p.angle), toScreenY(p.minVel!));
      else ctx.lineTo(toScreenX(p.angle), toScreenY(p.minVel!));
    });
    ctx.stroke();

    // --- 4. Render Center Point and Tolerances ---
    if (results.bestTrajectory) {
      const opt = parseVelocityVector(results.bestTrajectory.initialShootingVelocity);
      const optX = toScreenX(opt.angle);
      const optY = toScreenY(opt.velocity);

      // Match angle to nearest computed slice to extract vertical bounds
      const exactMatch = basinPoints.reduce((prev, curr) => 
        Math.abs(curr.angle - opt.angle) < Math.abs(prev.angle - opt.angle) ? curr : prev
      );

      // Draw Linear Extents
      ctx.save();
      ctx.setLineDash([4, 4]);
      
      // Horizontal Angle Window (Purple)
      ctx.strokeStyle = "#9c27b0";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(toScreenX(minAngleBounds), optY);
      ctx.lineTo(toScreenX(maxAngleBounds), optY);
      ctx.stroke();

      // Vertical Velocity Window (Orange)
      ctx.strokeStyle = "#ff9800";
      ctx.beginPath();
      ctx.moveTo(optX, toScreenY(exactMatch.maxVel!));
      ctx.lineTo(optX, toScreenY(exactMatch.minVel!));
      ctx.stroke();
      ctx.restore();

      // 5. Project Estimated Mechanical Variance Ellipse (Yellow)
      const ellipseW = (hardwareConfig.estimatedAngleError / (maxAngleBounds - minAngleBounds)) * (width - 100);
      const ellipseH = (hardwareConfig.estimatedVelocityError / (maxVelBounds - minVelBounds)) * (height - 60);

      ctx.beginPath();
      ctx.ellipse(optX, optY, Math.max(4, ellipseW), Math.max(4, ellipseH), 0, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffeb3b";
      ctx.fillStyle = "rgba(255, 235, 59, 0.15)";
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      // 6. Draw Reticle Star
      drawTargetStar(ctx, optX, optY, 5, 7, 3.5);
    }

    // --- Axis Text Labels ---
    ctx.fillStyle = "#8e8e93";
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`Angle Range: [${minAngleBounds.toFixed(1)}° - ${maxAngleBounds.toFixed(1)}°]`, 15, height - 12);
    ctx.textAlign = "right";
    ctx.fillText("Velocity vs Launch Angle Window", width - 15, height - 12);

  }, [results, hardwareConfig]);

  const drawTargetStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerR: number, innerR: number) => {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerR;
      y = cy + Math.sin(rot) * outerR;
      ctx.lineTo(x, y);
      rot += step;
      x = cx + Math.cos(rot) * innerR;
      y = cy + Math.sin(rot) * innerR;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#111115";
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", minHeight: "340px" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}