import { useEffect, useRef } from "react";
import { parseVelocityVector, type SharedConfig, type Trajectory, type Translation2d } from "../types";

export interface CustomGraph {
  name: string;
  color: string;
  unit: string;
  data: Translation2d[];
}

interface Props {
  closeTrajectories: Trajectory[];
  farTrajectories: Trajectory[];
  bestTrajectory: Trajectory | null;
  hardwareConfig: SharedConfig["hardware"];
  customGraphs?: CustomGraph[];
}

interface BasinPoint {
  angle: number;
  minVel?: number;
  maxVel?: number;
}

export default function ToleranceGraph({ closeTrajectories, farTrajectories, bestTrajectory, hardwareConfig, customGraphs = [] }: Props) {
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
    const rightAxisWidth = 50; // How much horizontal space each new axis takes
    const totalRightSpace = customGraphs.length > 0 ? (customGraphs.length * rightAxisWidth) + 10 : 30;

    const margin = { top: 40, right: totalRightSpace, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#111115";
    ctx.fillRect(0, 0, width, height);

    // --- Process Trajectory Collections ---
    const dataMap: { [key: string]: BasinPoint } = {};

    if (closeTrajectories) {
      closeTrajectories.forEach((trajectory) => {
        const { angle, velocity } = parseVelocityVector(trajectory.initialShootingVelocity);
        const key = angle.toFixed(1);
        if (!dataMap[key]) dataMap[key] = { angle };
        dataMap[key].minVel = velocity;
      });
    }

    if (farTrajectories) {
      farTrajectories.forEach((trajectory) => {
        const { angle, velocity } = parseVelocityVector(trajectory.initialShootingVelocity);
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
    const minVelocities = basinPoints.map((p) => p.minVel!);
    const maxVelocities = basinPoints.map((p) => p.maxVel!);

    // Prevent division by zero if there's only 1 point
    let minAngleBounds = hardwareConfig.minAngle;
    let maxAngleBounds = hardwareConfig.maxAngle;

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

    // --- Calculate Custom Graph Bounds ---
    // Pre-calculate the independent min/max bounds for every custom graph
    const customGraphBounds = customGraphs.map(graph => {
      if (graph.data.length === 0) return { min: 0, max: 1 };
      const values = graph.data.map(d => d.y);
      let min = Math.min(...values);
      let max = Math.max(...values);
      
      if (min === max) { min -= 1; max += 1; }
      
      // Add a 10% vertical padding so the custom graphs don't touch the absolute top/bottom
      const padding = (max - min) * 0.1;
      return { min: min - padding, max: max + padding };
    });

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

    customGraphs.forEach((graph, index) => {
      const bounds = customGraphBounds[index];
      const axisX = width - margin.right + 10 + (index * rightAxisWidth); // Offset each axis to the right

      ctx.strokeStyle = graph.color;
      ctx.fillStyle = graph.color;
      ctx.textAlign = "left";
      
      // Draw vertical axis line
      ctx.beginPath();
      ctx.moveTo(axisX, margin.top);
      ctx.lineTo(axisX, height - margin.bottom);
      ctx.stroke();

      // Draw ticks and labels
      const velSteps = 5;
      for (let i = 0; i <= velSteps; i++) {
        const val = bounds.min + (i / velSteps) * (bounds.max - bounds.min);
        // Custom scale for this specific axis:
        const y = margin.top + innerHeight - ((val - bounds.min) / (bounds.max - bounds.min)) * innerHeight;
        
        ctx.beginPath();
        ctx.moveTo(axisX, y);
        ctx.lineTo(axisX + 5, y); // Small tick mark
        ctx.stroke();
        
        // Format the number depending on how large it is
        const labelText = Math.abs(val) > 100 ? Math.round(val).toString() : val.toFixed(2);
        ctx.fillText(labelText, axisX + 8, y);
      }

      // Draw Axis Title (Rotated)
      ctx.save();
      ctx.translate(axisX + rightAxisWidth - 15, margin.top + innerHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.fillText(graph.unit, 0, 0);
      ctx.restore();
    });

    // --- 1. Draw Shaded Acceptable Launch Basin ---
    ctx.beginPath();
    basinPoints.forEach((p) => ctx.lineTo(toScreenX(p.angle), toScreenY(p.maxVel!)));
    for (let i = basinPoints.length - 1; i >= 0; i--) {
      ctx.lineTo(toScreenX(basinPoints[i].angle), toScreenY(basinPoints[i].minVel!));
    }
    ctx.closePath();
    ctx.fillStyle = "#44ef4420";
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

    // Optimal
    ctx.beginPath();
    ctx.strokeStyle = "#6e6e6e";
    ctx.lineWidth = 1;
    basinPoints.forEach((p, i) => {
      if (i === 0) ctx.moveTo(toScreenX(p.angle), toScreenY((p.minVel! + p.maxVel!) / 2));
      else ctx.lineTo(toScreenX(p.angle), toScreenY((p.minVel! + p.maxVel!) / 2));
    });
    ctx.stroke();

    // --- 4. Render Center Point and Tolerances ---
    if (bestTrajectory) {
      const opt = parseVelocityVector(bestTrajectory.initialShootingVelocity);
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
      if (bestTrajectory && bestTrajectory.tolerance) {
        const t = bestTrajectory.tolerance;
        
        // Convert derivative slope to radians
        const rotRads = (t.ellipseAngle || 0) * (Math.PI / 180);

        ctx.beginPath();

        // Calculate 60 points around the perimeter to form a smooth path
        const segments = 60;
        for (let i = 0; i <= segments; i++) {
          // t ranges from 0 to 2*PI
          const theta = (i / segments) * Math.PI * 2;

          // 1. Asymmetric Dimensions
          // If sin(theta) is positive, we are drawing the top half. If negative, the bottom half.
          const a = Math.cos(theta) >= 0 ? t.anglePositive : t.angleNegative;
          const b = Math.sin(theta) >= 0 ? t.velocityPositive : t.velocityNegative;

          // 2. Standard un-rotated ellipse math
          const u = a * Math.cos(theta);
          const v = b * Math.sin(theta);

          // 3. Apply 2D Rotation Matrix (Math Space)
          const rotatedAngle = (u * Math.cos(rotRads)) - (v * Math.sin(rotRads));
          const rotatedVel = (u * Math.sin(rotRads)) + (v * Math.cos(rotRads));

          // 4. Shift to the optimal target point
          const finalMathAngle = opt.angle + rotatedAngle;
          const finalMathVel = opt.velocity + rotatedVel;

          // 5. Map Math Space to Canvas Pixel Space using your existing scale functions
          const pixelX = toScreenX(finalMathAngle);
          const pixelY = toScreenY(finalMathVel);

          if (i === 0) {
            ctx.moveTo(pixelX, pixelY);
          } else {
            ctx.lineTo(pixelX, pixelY);
          }
        }

        ctx.closePath();
        ctx.strokeStyle = "#ffeb3b";
        ctx.fillStyle = "rgba(255, 235, 59, 0.2)";
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
      }

      // --- 6. Draw Reticle Star ---
      drawTargetStar(ctx, optX, optY, 5, 7, 3.5);

      if (customGraphs.length > 0) {
        customGraphs.forEach((graph, index) => {
          if (graph.data.length === 0) return;

          const bounds = customGraphBounds[index];
          const sortedData = [...graph.data].sort((a, b) => a.x - b.x);

          ctx.beginPath();
          ctx.strokeStyle = graph.color;
          ctx.lineWidth = 2.5;
          ctx.setLineDash([8, 2]);

          sortedData.forEach((point, pIndex) => {
            const px = toScreenX(point.x);
            // Translate the raw Y value to screen pixels using this specific graph's bounds
            const py = margin.top + innerHeight - ((point.y - bounds.min) / (bounds.max - bounds.min)) * innerHeight;
            
            if (pIndex === 0) {
              ctx.moveTo(px, py);
            } else {
              ctx.lineTo(px, py);
            }
          });
          ctx.stroke();
          ctx.setLineDash([]); // Reset line dash for anything drawn after this

          // Label the line
          const lastPoint = sortedData[sortedData.length - 1];
          const labelX = toScreenX(lastPoint.x) - 40;
          const labelY = margin.top + innerHeight - ((lastPoint.y - bounds.min) / (bounds.max - bounds.min)) * innerHeight - 10 + (index * 18);
          
          ctx.fillStyle = graph.color;
          ctx.textAlign = "right";
          ctx.font = "bold 12px sans-serif";
          ctx.fillText(graph.name, labelX, labelY);
        });
      }

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

  }, [closeTrajectories, farTrajectories, bestTrajectory, hardwareConfig]);

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