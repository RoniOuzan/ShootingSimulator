import { useEffect, useRef } from "react";
import type { Tolerance } from "../types"; // Adjust path if needed

interface Props {
  tolerance: Tolerance;
  optimalVelocity?: number;
  optimalAngle?: number;
}

export default function ToleranceChart({ tolerance, optimalVelocity, optimalAngle }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high-DPI (Retina) displays for crisp lines
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Clear canvas for re-renders
    ctx.clearRect(0, 0, width, height);

    // 1. Determine Scale (Find the largest bound to fit everything on screen)
    const maxVelBound = Math.max(tolerance.velocityPositive, tolerance.velocityNegative);
    const maxAngBound = Math.max(tolerance.anglePositive, tolerance.angleNegative);
    
    // Add 20% padding to the edges
    const scaleX = (width / 2) / (maxVelBound * 1.2);
    const scaleY = (height / 2) / (maxAngBound * 1.2);

    // Helper to convert physical delta to canvas pixels
    const toPxX = (deltaVel: number) => deltaVel * scaleX;
    const toPxY = (deltaAng: number) => -deltaAng * scaleY; // Y is inverted on canvas

    // 2. Draw Grid and Axes
    ctx.beginPath();
    ctx.strokeStyle = "#2a2a35";
    ctx.lineWidth = 1;
    
    // X-Axis (Velocity)
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    // Y-Axis (Angle)
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.stroke();

    // 3. Draw the Asymmetric Ellipse (Stitching 4 quadrants)
    ctx.beginPath();
    
    // Top-Right: (+Vel, +Ang)
    ctx.ellipse(centerX, centerY, toPxX(tolerance.velocityPositive), Math.abs(toPxY(tolerance.anglePositive)), 0, -Math.PI / 2, 0);
    // Bottom-Right: (+Vel, -Ang)
    ctx.ellipse(centerX, centerY, toPxX(tolerance.velocityPositive), Math.abs(toPxY(tolerance.angleNegative)), 0, 0, Math.PI / 2);
    // Bottom-Left: (-Vel, -Ang)
    ctx.ellipse(centerX, centerY, toPxX(tolerance.velocityNegative), Math.abs(toPxY(tolerance.angleNegative)), 0, Math.PI / 2, Math.PI);
    // Top-Left: (-Vel, +Ang)
    ctx.ellipse(centerX, centerY, toPxX(tolerance.velocityNegative), Math.abs(toPxY(tolerance.anglePositive)), 0, Math.PI, 3 * Math.PI / 2);

    // Fill and Stroke the Zone
    ctx.fillStyle = "rgba(74, 222, 128, 0.15)"; // Soft green fill
    ctx.fill();
    ctx.strokeStyle = "#4ade80"; // Bright green border
    ctx.lineWidth = 2;
    ctx.stroke();

    // 4. Draw Center Point (Optimal Setpoint)
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI);
    ctx.fillStyle = "#fff";
    ctx.fill();

    // 5. Draw Labels
    ctx.fillStyle = "#888";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    
    // Axis Labels
    ctx.fillText("+ Velocity", width - 30, centerY - 10);
    ctx.fillText("- Velocity", 30, centerY - 10);
    ctx.fillText("+ Angle", centerX + 30, 20);
    ctx.fillText("- Angle", centerX + 30, height - 10);

    // Optimal Values
    if (optimalVelocity !== undefined && optimalAngle !== undefined) {
      ctx.fillStyle = "#fff";
      ctx.fillText(`${optimalVelocity.toFixed(2)} m/s, ${optimalAngle.toFixed(1)}°`, centerX, centerY + 20);
    }

  }, [tolerance, optimalVelocity, optimalAngle]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas 
        ref={canvasRef} 
        style={{ width: "100%", height: "100%", display: "block" }} 
      />
    </div>
  );
}