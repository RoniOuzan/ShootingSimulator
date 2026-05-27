import { useEffect, useRef } from "react";
import { parseVelocityVector, type OptimalResults, type SharedConfig } from "../types";

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

    // --- Layout & Margins ---
    const margin = { top: 40, right: 30, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#111115";
    ctx.fillRect(0, 0, width, height);

    // --- Process Trajectory Collections ---
    const dataMap: { [key: string]: BasinPoint } = {};

    if (results.trajectories) {
      results.trajectories.forEach((couple) => {
        const { angle, velocity } = parseVelocityVector(couple.closeTrajectory.initialShootingVelocity);
        const key = angle.toFixed(1);
        if (!dataMap[key]) dataMap[key] = { angle };
        dataMap[key].minVel = velocity;
      });

      results.trajectories.forEach((couple) => {
        const { angle, velocity } = parseVelocityVector(couple.farTrajectory.initialShootingVelocity);
        const key = angle.toFixed(1);
        if (!dataMap[key]) dataMap[key] = { angle };
        dataMap[key].maxVel = velocity;
      });
    }

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

    // --- Coordinate Bounds ---
    const angles = basinPoints.map((p) => p.angle);
    const minVelocities = basinPoints.map((p) => p.minVel!);
    const maxVelocities = basinPoints.map((p) => p.maxVel!);

    // Prevent division by zero if there's only 1 point
    let minAngleBounds = Math.min(...angles);
    let maxAngleBounds = Math.max(...angles);
    if (minAngleBounds === maxAngleBounds) {
      minAngleBounds -= 5;
      maxAngleBounds += 5;
    }

    let minVelBounds = Math.min(...minVelocities) - 0.5;
    let maxVelBounds = Math.max(...maxVelocities) + 0.5;
    if (minVelBounds === maxVelBounds) {
      minVelBounds -= 1;
      maxVelBounds += 1;
    }

    // Scaling functions
    const toScreenX = (angle: number) =>
      margin.left + ((angle - minAngleBounds) / (maxAngleBounds - minAngleBounds)) * innerWidth;
    const toScreenY = (vel: number) =>
      margin.top + innerHeight - ((vel - minVelBounds) / (maxVelBounds - minVelBounds)) * innerHeight;

    // --- Draw Grid & Axes ---
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillStyle = "#8e8e93";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 1;

    // X-Axis (Angles)
    const angleSteps = 5; // How many grid lines on X
    for (let i = 0; i <= angleSteps; i++) {
      const angleVal = minAngleBounds + (i / angleSteps) * (maxAngleBounds - minAngleBounds);
      const x = toScreenX(angleVal);
      ctx.beginPath(); ctx.moveTo(x, margin.top); ctx.lineTo(x, height - margin.bottom); ctx.stroke();
      ctx.fillText(`${angleVal.toFixed(1)}°`, x, height - margin.bottom + 15);
    }

    // Y-Axis (Velocities)
    ctx.textAlign = "right";
    const velSteps = 5; // How many grid lines on Y
    for (let i = 0; i <= velSteps; i++) {
      const velVal = minVelBounds + (i / velSteps) * (maxVelBounds - minVelBounds);
      const y = toScreenY(velVal);
      ctx.beginPath(); ctx.moveTo(margin.left, y); ctx.lineTo(width - margin.right, y); ctx.stroke();
      ctx.fillText(`${velVal.toFixed(1)}`, margin.left - 10, y);
    }

    // Axis Titles
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText("Launch Angle (°)", margin.left + innerWidth / 2, height - 15);
    
    ctx.save();
    ctx.translate(20, margin.top + innerHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Velocity (m/s)", 0, 0);
    ctx.restore();

    // --- 1. Draw Shaded Acceptable Launch Basin ---
    ctx.beginPath();
    basinPoints.forEach((p) => ctx.lineTo(toScreenX(p.angle), toScreenY(p.maxVel!)));
    for (let i = basinPoints.length - 1; i >= 0; i--) {
      ctx.lineTo(toScreenX(basinPoints[i].angle), toScreenY(basinPoints[i].minVel!));
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
    ctx.fill();

    // --- 2. Draw Max Speed Bound (Far Edge - Green) ---
    ctx.beginPath();
    ctx.strokeStyle = "#44ef44";
    ctx.lineWidth = 2.5;
    basinPoints.forEach((p, i) => {
      if (i === 0) ctx.moveTo(toScreenX(p.angle), toScreenY(p.maxVel!));
      else ctx.lineTo(toScreenX(p.angle), toScreenY(p.maxVel!));
    });
    ctx.stroke();

    // --- 3. Draw Min Speed Bound (Close Edge - Red) ---
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

      const exactMatch = basinPoints.reduce((prev, curr) =>
        Math.abs(curr.angle - opt.angle) < Math.abs(prev.angle - opt.angle) ? curr : prev
      );

      ctx.save();
      ctx.setLineDash([4, 4]);

      // Vertical Velocity Window (Orange)
      ctx.strokeStyle = "#ff9800";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(optX, toScreenY(exactMatch.maxVel!));
      ctx.lineTo(optX, toScreenY(exactMatch.minVel!));
      ctx.stroke();

      // Horizontal Angle Window (Purple) - Accurately finding the basin width at this specific velocity
      const validAnglesAtOptVel = basinPoints.filter(p => p.minVel! <= opt.velocity && p.maxVel! >= opt.velocity);
      if (validAnglesAtOptVel.length > 0) {
        const safeMinAngle = validAnglesAtOptVel[0].angle;
        const safeMaxAngle = validAnglesAtOptVel[validAnglesAtOptVel.length - 1].angle;
        
        ctx.strokeStyle = "#9c27b0";
        ctx.beginPath();
        ctx.moveTo(toScreenX(safeMinAngle), optY);
        ctx.lineTo(toScreenX(safeMaxAngle), optY);
        ctx.stroke();
      }
      ctx.restore();

      // --- 5. Project Estimated Mechanical Variance Ellipse (Yellow) ---
      const ellipseW = (hardwareConfig.estimatedAngleError / (maxAngleBounds - minAngleBounds)) * innerWidth;
      const ellipseH = (hardwareConfig.estimatedVelocityError / (maxVelBounds - minVelBounds)) * innerHeight;

      ctx.beginPath();
      ctx.ellipse(optX, optY, Math.max(4, ellipseW), Math.max(4, ellipseH), 0, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffeb3b";
      ctx.fillStyle = "rgba(255, 235, 59, 0.2)";
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      // --- 6. Draw Reticle Star ---
      drawTargetStar(ctx, optX, optY, 5, 7, 3.5);

      // --- 7. Draw Data Legend ---
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(margin.left + 10, margin.top + 10, 160, 45);
      ctx.strokeStyle = "#444";
      ctx.strokeRect(margin.left + 10, margin.top + 10, 160, 45);
      
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.font = "12px sans-serif";
      ctx.fillText(`Opt Angle: ${opt.angle.toFixed(2)}°`, margin.left + 20, margin.top + 26);
      ctx.fillText(`Opt Vel: ${opt.velocity.toFixed(2)} m/s`, margin.left + 20, margin.top + 42);
    }

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