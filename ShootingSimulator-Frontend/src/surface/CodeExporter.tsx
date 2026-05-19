import MultivariateLinearRegression from "ml-regression-multivariate-linear";
import { useMemo, useState } from "react";

export interface DataPoint {
  distance: number;
  radialVelocity: number;
  bestAngle: number;
  bestExitVelocity: number;
}

export interface DatasetState {
  normal: DataPoint[];
  min: DataPoint[];
  max: DataPoint[];
}

export interface ModelState {
  angleModel: MultivariateLinearRegression | null;
  velocityModel: MultivariateLinearRegression;
  angleDegree: number | null;
  velocityDegree: number;
}

interface Props {
  models: {
    normal: ModelState | null;
    min: ModelState | null;
    max: ModelState | null;
  };
  hardware: { minAngle: number; maxAngle: number };
  datasetCounts?: { normal: number; min: number; max: number };
}

// ── Polynomial feature expansion ─────────────────────────────────────────────
export const getPolynomialFeatures = (
  d: number,
  vr: number,
  degree: number,
) => {
  const features: number[] = [];
  const names: { pD: number; pVR: number }[] = [];

  features.push(1.0);
  names.push({ pD: 0, pVR: 0 });

  for (let i = 1; i <= degree; i++) {
    for (let j = 0; j <= i; j++) {
      const k = i - j;
      features.push(Math.pow(d, k) * Math.pow(vr, j));
      names.push({ pD: k, pVR: j });
    }
  }
  return { features, names };
};

// ── Term builder helpers ──────────────────────────────────────────────────────
function buildTermString(
  coef: number,
  pD: number,
  pVR: number,
  isFirst: boolean,
): string {
  const abs = Math.abs(coef);
  const sign = coef < 0 ? " -\n                " : isFirst ? "" : " +\n                ";
  let term = `${sign}(${abs.toFixed(10)}`;
  for (let i = 0; i < pD; i++) term += " * d";
  for (let i = 0; i < pVR; i++) term += " * vr";
  term += ")";
  return term;
}

function generateEquation(
  model: MultivariateLinearRegression | null,
  degree: number | null,
): string {
  if (!model || degree === null) return "0.0";
  const { names } = getPolynomialFeatures(1, 1, degree);
  const weights = model.weights;

  const terms: string[] = [];
  for (let i = 0; i < weights.length; i++) {
    const coef = weights[i][0];
    if (Math.abs(coef) < 1e-9) continue;
    const { pD, pVR } = names[i];
    terms.push(buildTermString(coef, pD, pVR, terms.length === 0));
  }
  return terms.length > 0 ? terms.join("") : "0.0";
}

// ── Derivative Term Builder ──────────────────────────────────────────────────
function generateDerivativeEquation(
  model: MultivariateLinearRegression | null,
  degree: number | null,
  targetVar: 'd' | 'vr'
): string {
  if (!model || degree === null) return "0.0";
  const { names } = getPolynomialFeatures(1, 1, degree);
  const weights = model.weights;
  const terms: string[] = [];

  for (let i = 0; i < weights.length; i++) {
    const coef = weights[i][0];
    const { pD, pVR } = names[i];
    
    let derivativeCoef = 0;
    let newPD = pD;
    let newPVR = pVR;

    if (targetVar === 'd' && pD > 0) {
      derivativeCoef = coef * pD;
      newPD = pD - 1;
    } else if (targetVar === 'vr' && pVR > 0) {
      derivativeCoef = coef * pVR;
      newPVR = pVR - 1;
    }

    if (Math.abs(derivativeCoef) < 1e-9) continue;
    terms.push(buildTermString(derivativeCoef, newPD, newPVR, terms.length === 0));
  }
  return terms.length > 0 ? terms.join("") : "0.0";
}

// ── Java Generators ──────────────────────────────────────────────────────────

const BASE_PACKAGE = "package frc.robot.aiming;";

function buildPresetCode(): string {
  return `${BASE_PACKAGE}

import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Rotation3d;
import edu.wpi.first.math.geometry.Translation3d;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ShootingPreset {
    private final Rotation2d pitch;
    private final Rotation2d yaw;
    private final double velocity;

    private final double dPitch; // radians / sec
    private final double dYaw;   // radians / sec
    private final double dVelocity;

    private final double flightTime;

    public Translation3d getTranslation3d() {
        return new Translation3d(this.velocity,
                new Rotation3d(0, -this.pitch.getRadians(), this.yaw.getRadians()));
    }
}`;
}

function buildAbstractModelCode(): string {
  return `${BASE_PACKAGE}

import com.shooting_simulator.util.math.geometry.Rotation2d;
import com.shooting_simulator.util.math.geometry.Translation2d;

/**
 * Abstract base class for auto-generated shooter kinematics models.
 * Calculates positional targets and feedforward time-derivatives for shooting on the move.
 * <p>
 * Note on Coordinate System:
 * Radial Velocity is NEGATIVE when driving towards the target (distance is decreasing).
 * Radial Velocity is POSITIVE when driving away from the target (distance is increasing).
 */
public abstract class ShootingModel {

    /** @return The maximum physical pitch angle of the shooter pivot. */
    protected abstract double getMaxAngle();

    /** @return The minimum physical pitch angle of the shooter pivot. */
    protected abstract double getMinAngle();

    // =========================================================================
    // BASE POSITIONAL TARGETS
    // =========================================================================

    /**
     * Calculates the required shooter pitch angle.
     * @param distanceMeters Distance from the robot to the target in meters.
     * @param radialVelocityMps Radial velocity in meters/sec (negative = closing distance).
     * @return The target pitch Rotation2d.
     */
    public abstract double getAngle(double distanceMeters, double radialVelocityMps);

    /** Partial derivative of Pitch with respect to Distance (rad / m). */
    public abstract double getAngleDerivativeDistance(double distanceMeters, double radialVelocityMps);

    /** Partial derivative of Pitch with respect to Radial Velocity (rad / (m/s)). */
    public abstract double getAngleDerivativeRadialVelocity(double distanceMeters, double radialVelocityMps);

    /**
     * Calculates the estimated time the ball will be in the air.
     * @return Flight time in seconds.
     */
    public abstract double getFlightTime(double distanceMeters, double radialVelocityMps);

    // =========================================================================
    // FLYWHEEL VELOCITY TARGETS
    // =========================================================================

    public abstract double getVelocityNormal(double distanceMeters, double radialVelocityMps);
    public abstract double getVelocityMinAngle(double distanceMeters, double radialVelocityMps);
    public abstract double getVelocityMaxAngle(double distanceMeters, double radialVelocityMps);

    /**
     * Safely gets the flywheel velocity, clamping to boundary equations if the target
     * angle exceeds the physical capabilities of the pivot.
     */
    public double getVelocity(double angle, double distanceMeters, double radialVelocityMps) {
        if (angle <= getMinAngle())
            return getVelocityMinAngle(distanceMeters, radialVelocityMps);
        if (angle >= getMaxAngle())
            return getVelocityMaxAngle(distanceMeters, radialVelocityMps);

        return getVelocityNormal(distanceMeters, radialVelocityMps);
    }

    // Partial derivatives for Flywheel Velocity (Units depend on your generated model, e.g., RadPerSec / m)
    public abstract double getVelocityNormalDerivativeDistance(double distanceMeters, double radialVelocityMps);
    public abstract double getVelocityMinAngleDerivativeDistance(double distanceMeters, double radialVelocityMps);
    public abstract double getVelocityMaxAngleDerivativeDistance(double distanceMeters, double radialVelocityMps);

    public double getVelocityDerivativeDistance(double angle, double distanceMeters, double radialVelocityMps) {
        if (angle <= getMinAngle())
            return getVelocityMinAngleDerivativeDistance(distanceMeters, radialVelocityMps);
        if (angle >= getMaxAngle())
            return getVelocityMaxAngleDerivativeDistance(distanceMeters, radialVelocityMps);

        return getVelocityNormalDerivativeDistance(distanceMeters, radialVelocityMps);
    }

    public abstract double getVelocityNormalDerivativeRadialVelocity(double distanceMeters, double radialVelocityMps);
    public abstract double getVelocityMinAngleDerivativeRadialVelocity(double distanceMeters, double radialVelocityMps);
    public abstract double getVelocityMaxAngleDerivativeRadialVelocity(double distanceMeters, double radialVelocityMps);

    public double getVelocityDerivativeRadialVelocity(double angle, double distanceMeters, double radialVelocityMps) {
        if (angle <= getMinAngle())
            return getVelocityMinAngleDerivativeRadialVelocity(distanceMeters, radialVelocityMps);
        if (angle >= getMaxAngle())
            return getVelocityMaxAngleDerivativeRadialVelocity(distanceMeters, radialVelocityMps);

        return getVelocityNormalDerivativeRadialVelocity(distanceMeters, radialVelocityMps);
    }

    // =========================================================================
    // STATE GENERATOR (THE MANAGER)
    // =========================================================================

    /**
     * Packages the generated equations into a single preset.
     * Applies the Multivariable Chain Rule to convert spatial/velocity partial derivatives
     * into true time derivatives for feedforward controllers.
     *
     * @param origin Current field-relative position of the robot (meters).
     * @param target Field-relative position of the target (meters).
     * @param originVelocity Current field-relative velocity vector of the robot (m/s).
     * @param originAcceleration Current field-relative acceleration vector of the robot (m/s^2).
     * @return A complete ShootingPreset containing targets and time-derivatives.
     */
    public ShootingPreset getPreset(
            Translation2d origin,
            Translation2d target,
            Translation2d originVelocity,
            Translation2d originAcceleration
    ) {
        double distanceMeters = origin.getDistance(target);

        Translation2d decomposedVelocity = decomposeVelocity(origin, target, originVelocity);
        Translation2d decomposedAcceleration = decomposeVelocity(origin, target, originAcceleration);

        double radialVelocityMps = decomposedVelocity.getX();
        double tangentialVelocityMps = decomposedVelocity.getY();

        double radialAccelerationMpsSq = decomposedAcceleration.getX();
        double tangentialAccelerationMpsSq = decomposedAcceleration.getY();

        // Calculate Base Targets
        double pitch = getAngle(distanceMeters, radialVelocityMps);
        double flywheelVelocity = getVelocity(pitch, distanceMeters, radialVelocityMps);
        double flightTimeSeconds = getFlightTime(distanceMeters, radialVelocityMps);

        // Multivariable Chain Rule for Time Derivatives (d/dt)
        // dθ/dt = (∂θ/∂d * dd/dt) + (∂θ/∂v_r * dv_r/dt)
        double pitchVelDegPerSec = getPitchVelocity(distanceMeters, radialVelocityMps, radialAccelerationMpsSq);
        double flywheelAcceleration = getVelocityAcceleration(pitch, distanceMeters, radialVelocityMps, radialAccelerationMpsSq);

        // Tangential Yaw Calculation (Isolating lateral drift)
        Rotation2d angleToTarget = target.minus(origin).getAngle();
        Translation2d lateralDrift = new Translation2d(0, tangentialVelocityMps * flightTimeSeconds).rotateBy(angleToTarget);

        // Aim upstream to cancel the drift
        Translation2d effectiveTarget = target.minus(lateralDrift);
        Rotation2d yaw = effectiveTarget.minus(origin).getAngle();

        double yawVelocityRadPerSec = getYawVelocity(distanceMeters, radialVelocityMps, tangentialVelocityMps, tangentialAccelerationMpsSq, flightTimeSeconds);

        return new ShootingPreset(
                Rotation2d.fromDegrees(pitchVelDegPerSec),
                yaw,
                flywheelVelocity,
                pitchVelDegPerSec,
                yawVelocityRadPerSec,
                flywheelAcceleration,
                flightTimeSeconds
        );
    }

    // =========================================================================
    // INTERNAL KINEMATICS HELPERS
    // =========================================================================

    private double getPitchVelocity(double distanceMeters, double radialVelocityMps, double radialAccelerationMpsSq) {
        double dAngleDistance = getAngleDerivativeDistance(distanceMeters, radialVelocityMps);
        double dAngleRadialVelocity = getAngleDerivativeRadialVelocity(distanceMeters, radialVelocityMps);

        return (dAngleDistance * radialVelocityMps) + (dAngleRadialVelocity * radialAccelerationMpsSq);
    }

    private double getVelocityAcceleration(double pitch, double distanceMeters, double radialVelocityMps, double radialAccelerationMpsSq) {
        double dVelocityDistance = getVelocityDerivativeDistance(pitch, distanceMeters, radialVelocityMps);
        double dVelocityRadialVelocity = getVelocityDerivativeRadialVelocity(pitch, distanceMeters, radialVelocityMps);

        return (dVelocityDistance * radialVelocityMps) + (dVelocityRadialVelocity * radialAccelerationMpsSq);
    }

    private double getYawVelocity(double distanceMeters, double radialVelocityMps, double tangentialVelocityMps, double tangentialAccelerationMpsSq, double flightTimeSeconds) {
        // Component 1: Base tracking (rotating to track stationary target while strafing)
        // If we strafe Left (positive), we must rotate Right (negative)
        double baseTrackingRate = -tangentialVelocityMps / distanceMeters;

        // Component 2: The rate of change of our lead angle offset via the quotient rule
        double driftMeters = tangentialVelocityMps * flightTimeSeconds;
        double driftDerivativeMps = tangentialAccelerationMpsSq * flightTimeSeconds;

        double denominator = (distanceMeters * distanceMeters) + (driftMeters * driftMeters);
        double leadAdjustmentRate = ((driftMeters * radialVelocityMps) - (driftDerivativeMps * distanceMeters)) / denominator;

        return baseTrackingRate + leadAdjustmentRate;
    }

    /**
     * Decomposes a global field-relative vector into target-relative radial and tangential components.
     *
     * @return A Translation2d where:
     *         X = Radial component (Negative = towards target, Positive = away).
     *         Y = Tangential component (Positive = strafing left, Negative = strafing right).
     */
    private static Translation2d decomposeVelocity(
            Translation2d origin,
            Translation2d target,
            Translation2d globalVector) {

        // Find the vector pointing from the robot to the target
        Translation2d robotToTarget = target.minus(origin);
        Rotation2d angleToTarget = robotToTarget.getAngle();

        // Rotate the vector by the inverse of the target angle to align it with the X/Y axes.
        Translation2d standardRelativeVector = globalVector.rotateBy(angleToTarget.unaryMinus());

        // Invert X to enforce the convention that moving towards the target decreases distance (negative velocity)
        return new Translation2d(
                -standardRelativeVector.getX(),
                standardRelativeVector.getY()
        );
    }
}`;
}

function buildGeneratedCode(models: Props["models"], hardware: Props["hardware"]): string {
  const hasData = !!models.normal;
  const nAd = models.normal?.angleDegree ?? 4;
  const nVd = models.normal?.velocityDegree ?? 4;
  
  const minVd = models.min?.velocityDegree ?? 2;
  const maxVd = models.max?.velocityDegree ?? 2;

  const getEq = (m: any, d: number | null) => hasData ? generateEquation(m, d) : "0.0";
  const getD1 = (m: any, d: number | null, v: 'd' | 'vr') => hasData ? generateDerivativeEquation(m, d, v) : "0.0";

  return `${BASE_PACKAGE}

import edu.wpi.first.math.geometry.Rotation2d;

// THIS FILE IS AUTO-GENERATED BY THE SHOOTER SIMULATOR. DO NOT EDIT MANUALLY.
public class GeneratedShooterModel extends ShootingModel {

    @Override
    protected double getMinAngle() { return ${hardware.minAngle.toFixed(2)}; }

    @Override
    protected double getMaxAngle() { return ${hardware.maxAngle.toFixed(2)}; }

    // =========================================================================
    // BASE POSITIONAL TARGETS
    // =========================================================================

    @Override
    public double getAngle(double d, double vr) {
        return ${getEq(models.normal?.angleModel, nAd)};
    }

    @Override
    public double getAngleDerivativeDistance(double d, double vr) {
        return ${getD1(models.normal?.angleModel, nAd, 'd')};
    }

    @Override
    public double getAngleDerivativeRadialVelocity(double d, double vr) {
        return ${getD1(models.normal?.angleModel, nAd, 'vr')};
    }

    @Override
    public double getFlightTime(double d, double vr) {
        return 0;
    }

    // =========================================================================
    // FLYWHEEL VELOCITY TARGETS
    // =========================================================================

    // ── Normal Regime ──
    @Override
    public double getVelocityNormal(double d, double vr) {
        return ${getEq(models.normal?.velocityModel, nVd)};
    }
    
    @Override
    public double getVelocityNormalDerivativeDistance(double d, double vr) {
        return ${getD1(models.normal?.velocityModel, nVd, 'd')};
    }
    
    @Override
    public double getVelocityNormalDerivativeRadialVelocity(double d, double vr) {
        return ${getD1(models.normal?.velocityModel, nVd, 'vr')};
    }

    // ── Min Angle Boundary ──
    @Override
    public double getVelocityMinAngle(double d, double vr) {
        return ${getEq(models.min?.velocityModel, minVd)};
    }
    
    @Override
    public double getVelocityMinAngleDerivativeDistance(double d, double vr) {
        return ${getD1(models.min?.velocityModel, minVd, 'd')};
    }
    
    @Override
    public double getVelocityMinAngleDerivativeRadialVelocity(double d, double vr) {
        return ${getD1(models.min?.velocityModel, minVd, 'vr')};
    }

    // ── Max Angle Boundary ──
    @Override
    public double getVelocityMaxAngle(double d, double vr) {
        return ${getEq(models.max?.velocityModel, maxVd)};
    }
    
    @Override
    public double getVelocityMaxAngleDerivativeDistance(double d, double vr) {
        return ${getD1(models.max?.velocityModel, maxVd, 'd')};
    }
    
    @Override
    public double getVelocityMaxAngleDerivativeRadialVelocity(double d, double vr) {
        return ${getD1(models.max?.velocityModel, maxVd, 'vr')};
    }
}`;
}

// ── Component ──────────────────────────────────────────────────────────────

type Tab = "preset" | "model" | "generated";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "preset", label: "ShootingPreset.java", icon: "☕" },
  { id: "model", label: "ShootingModel.java", icon: "☕" },
  { id: "generated", label: "GeneratedShooterModel.java", icon: "⚙️" },
];

export default function CodeExporter({
  models,
  hardware,
  datasetCounts,
}: Props) {
  const [tab, setTab] = useState<Tab>("generated");
  const [copied, setCopied] = useState(false);
  
  const hasData = !!models.normal;

  const codes = useMemo(() => ({
    preset: buildPresetCode(),
    model: buildAbstractModelCode(),
    generated: buildGeneratedCode(models, hardware),
  }), [models, hardware]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codes[tab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalPoints = (datasetCounts?.normal ?? 0) + (datasetCounts?.min ?? 0) + (datasetCounts?.max ?? 0);

  return (
    <div style={{ 
      marginTop: 20, 
      display: "flex",
      flexDirection: "column",
      borderRadius: 10,
      overflow: "hidden",
      border: `1px solid ${hasData ? "#007acc" : "#444"}`, // VSCode Blue accent
      background: "#1e1e1e",
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)"
    }}>
      
      {/* IDE Tab Bar */}
      <div style={{ display: "flex", background: "#252526", borderBottom: "1px solid #333", overflowX: "auto" }}>
        {TABS.map(({ id, label, icon }) => (
          <div
            key={id}
            onClick={() => setTab(id)}
            style={{
              padding: "10px 16px",
              fontSize: "0.85rem",
              fontFamily: "system-ui, sans-serif",
              cursor: "pointer",
              background: tab === id ? "#1e1e1e" : "transparent",
              color: tab === id ? "#fff" : "#969696",
              borderTop: `2px solid ${tab === id ? "#007acc" : "transparent"}`,
              borderRight: "1px solid #333",
              display: "flex",
              alignItems: "center",
              gap: 8,
              transition: "background 0.2s"
            }}
          >
            <span>{icon}</span>
            {label}
          </div>
        ))}
        
        {/* Action Buttons Spacer */}
        <div style={{ flex: 1 }} />
        
        <button
          onClick={handleCopy}
          style={{
            margin: "6px 12px",
            padding: "4px 12px",
            fontSize: "0.8rem",
            background: copied ? "#2ea043" : "#0e639c",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {copied ? "✓ Copied" : "Copy File"}
        </button>
      </div>

      {/* Code Area */}
      <pre
        style={{
          margin: 0,
          padding: "16px",
          background: "#1e1e1e",
          color: "#d4d4d4", // VSCode Default text
          fontSize: "0.85rem",
          lineHeight: 1.5,
          overflowX: "auto",
          height: 480,
          overflowY: "auto",
          fontFamily: "'Fira Code', 'Consolas', monospace"
        }} 
      >
        <code>
          {codes[tab]}
        </code>
      </pre>

      {/* IDE Status Bar */}
      <div style={{
        display: "flex",
        background: "#007acc",
        color: "#fff",
        padding: "4px 12px",
        fontSize: "0.75rem",
        fontFamily: "system-ui, sans-serif",
        justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", gap: 16 }}>
          <span>✗ 0 Errors</span>
          <span>⚠ 0 Warnings</span>
          <span>REBUILT 2026</span>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <span>Status: {hasData ? "Calibrated" : "Template Mode"}</span>
          {hasData && <span>Dataset: {totalPoints.toLocaleString()} points</span>}
          <span>UTF-8</span>
          <span>Java</span>
        </div>
      </div>
    </div>
  );
}