import MultivariateLinearRegression from "ml-regression-multivariate-linear";
import { useMemo, useState } from "react";
import "./CodeExporter.css"; // IMPORTANT: Import the new CSS file
import { TARGET_VARIABLES, VAR_KEYS } from "./shooterConfig";

export interface DataPoint {
  distance: number;
  radialVelocity: number;
  outputs: Record<string, number>;
}

export interface DatasetState {
  normal: DataPoint[];
  min: DataPoint[];
  max: DataPoint[];
}

export interface ModelState {
  models: Record<string, MultivariateLinearRegression | null>;
  degrees: Record<string, number | null>;
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

const BASE_PACKAGE = "package frc.robot.subsystems.shooting;";

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

import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Translation2d;

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
     * @return The target pitch in degrees.
     */
    public abstract double getAngle(double distanceMeters, double radialVelocityMps);

    /** Partial derivative of Pitch with respect to Distance (deg / m). */
    public abstract double getAngleDerivativeDistance(double distanceMeters, double radialVelocityMps);

    /** Partial derivative of Pitch with respect to Radial Velocity (deg / (m/s)). */
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

    // Partial derivatives for Flywheel Velocity
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
        double pitchDegrees = getAngle(distanceMeters, radialVelocityMps);
        double flywheelVelocityMps = getVelocity(pitchDegrees, distanceMeters, radialVelocityMps);
        double flightTimeSeconds = getFlightTime(distanceMeters, radialVelocityMps);

        // Multivariable Chain Rule for Time Derivatives (d/dt)
        double pitchVelRadPerSec = getPitchVelocity(distanceMeters, radialVelocityMps, radialAccelerationMpsSq);
        double flywheelAccelerationMpsSq = getVelocityAcceleration(pitchDegrees, distanceMeters, radialVelocityMps, radialAccelerationMpsSq);

        // Tangential Yaw Calculation (Isolating lateral drift)
        Rotation2d angleToTarget = target.minus(origin).getAngle();
        Translation2d lateralDrift = new Translation2d(0, tangentialVelocityMps * flightTimeSeconds).rotateBy(angleToTarget);

        // Aim upstream to cancel the drift
        Translation2d effectiveTarget = target.minus(lateralDrift);
        Rotation2d yaw = effectiveTarget.minus(origin).getAngle();

        double yawVelocityRadPerSec = getYawVelocity(distanceMeters, radialVelocityMps, tangentialVelocityMps, tangentialAccelerationMpsSq, flightTimeSeconds);

        return new ShootingPreset(
                Rotation2d.fromDegrees(pitchDegrees),
                yaw,
                flywheelVelocityMps,
                pitchVelRadPerSec,
                yawVelocityRadPerSec,
                flywheelAccelerationMpsSq,
                flightTimeSeconds
        );
    }

    // =========================================================================
    // INTERNAL KINEMATICS HELPERS
    // =========================================================================

    private double getPitchVelocity(double distanceMeters, double radialVelocityMps, double radialAccelerationMpsSq) {
        // Convert the degree-based derivatives into Radians for the WPILib feedforward
        double dAngleDistanceRad = Math.toRadians(getAngleDerivativeDistance(distanceMeters, radialVelocityMps));
        double dAngleRadialVelocityRad = Math.toRadians(getAngleDerivativeRadialVelocity(distanceMeters, radialVelocityMps));

        return (dAngleDistanceRad * radialVelocityMps) + (dAngleRadialVelocityRad * radialAccelerationMpsSq);
    }

    private double getVelocityAcceleration(double pitch, double distanceMeters, double radialVelocityMps, double radialAccelerationMpsSq) {
        double dVelocityDistance = getVelocityDerivativeDistance(pitch, distanceMeters, radialVelocityMps);
        double dVelocityRadialVelocity = getVelocityDerivativeRadialVelocity(pitch, distanceMeters, radialVelocityMps);

        return (dVelocityDistance * radialVelocityMps) + (dVelocityRadialVelocity * radialAccelerationMpsSq);
    }

    private double getYawVelocity(double distanceMeters, double radialVelocityMps, double tangentialVelocityMps, double tangentialAccelerationMpsSq, double flightTimeSeconds) {
        double baseTrackingRate = -tangentialVelocityMps / distanceMeters;

        double driftMeters = tangentialVelocityMps * flightTimeSeconds;
        double driftDerivativeMps = tangentialAccelerationMpsSq * flightTimeSeconds;

        double denominator = (distanceMeters * distanceMeters) + (driftMeters * driftMeters);
        double leadAdjustmentRate = ((driftMeters * radialVelocityMps) - (driftDerivativeMps * distanceMeters)) / denominator;

        return baseTrackingRate + leadAdjustmentRate;
    }

    private static Translation2d decomposeVelocity(
            Translation2d origin,
            Translation2d target,
            Translation2d globalVector) {

        Translation2d robotToTarget = target.minus(origin);
        Rotation2d angleToTarget = robotToTarget.getAngle();

        Translation2d standardRelativeVector = globalVector.rotateBy(angleToTarget.unaryMinus());

        // Invert X to enforce the convention that moving towards the target decreases distance (negative velocity)
        return new Translation2d(
                -standardRelativeVector.getX(),
                standardRelativeVector.getY()
        );
    }
}`;
}

function buildGeneratedCode(models: any, hardware: any): string {
  const hasData = !!models.normal;
  const getEq = (m: any, d: number | null) => hasData ? generateEquation(m, d) : "0.0";
  const getD1 = (m: any, d: number | null, v: 'd' | 'vr') => hasData ? generateDerivativeEquation(m, d, v) : "0.0";

  let javaCode = `${BASE_PACKAGE}

// THIS FILE IS AUTO-GENERATED BY THE SHOOTER SIMULATOR. DO NOT EDIT MANUALLY.
public class GeneratedShooterModel extends ShootingModel {

    @Override
    protected double getMinAngle() { return ${hardware.minAngle.toFixed(2)}; }

    @Override
    protected double getMaxAngle() { return ${hardware.maxAngle.toFixed(2)}; }
`;

  // Dynamically generate all kinematic equations
  for (const key of VAR_KEYS) {
    const config = TARGET_VARIABLES[key];
    const Name = key.charAt(0).toUpperCase() + key.slice(1);
    
    javaCode += `\n    // === ${config.name.toUpperCase()} TARGETS ===\n`;

    if (config.isBoundaryAxis) {
      // Boundary variables (like Angle) just need base equations
      javaCode += `
    @Override
    public double get${Name}(double d, double vr) {
        return ${getEq(models.normal?.models[key], models.normal?.degrees[key])};
    }
    @Override
    public double get${Name}DerivativeDistance(double d, double vr) {
        return ${getD1(models.normal?.models[key], models.normal?.degrees[key], 'd')};
    }
    @Override
    public double get${Name}DerivativeRadialVelocity(double d, double vr) {
        return ${getD1(models.normal?.models[key], models.normal?.degrees[key], 'vr')};
    }\n`;
    } else {
      // Dependent variables (like Velocity, Spin) need bounds equations
      const regimes = ['Normal', 'MinAngle', 'MaxAngle'] as const;
      const modelKeys = ['normal', 'min', 'max'] as const;

      for (let i = 0; i < regimes.length; i++) {
        const r = regimes[i];
        const mk = modelKeys[i];
        javaCode += `
    @Override
    public double get${Name}${r}(double d, double vr) {
        return ${getEq(models[mk]?.models[key], models[mk]?.degrees[key])};
    }
    @Override
    public double get${Name}${r}DerivativeDistance(double d, double vr) {
        return ${getD1(models[mk]?.models[key], models[mk]?.degrees[key], 'd')};
    }
    @Override
    public double get${Name}${r}DerivativeRadialVelocity(double d, double vr) {
        return ${getD1(models[mk]?.models[key], models[mk]?.degrees[key], 'vr')};
    }\n`;
      }
    }
  }

  javaCode += `}`;
  return javaCode;
}

// ── Component ──────────────────────────────────────────────────────────────

type Tab = "preset" | "model" | "generated";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "preset", label: "ShootingPreset.java", icon: "📦" },
  { id: "model", label: "ShootingModel.java", icon: "📐" },
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
    <div className="code-exporter-wrapper">
      
      {/* Top Bar Navigation */}
      <div className="exporter-header">
        
        {/* Pills Tab Selector */}
        <div className="exporter-tabs">
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`tab-btn ${tab === id ? 'active' : ''}`}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className={`copy-btn ${copied ? 'copied' : ''}`}
        >
          {copied ? "✓ Copied" : "Copy Source"}
        </button>
      </div>

      {/* Code Display Area */}
      <pre className="code-display">
        <code>
          {codes[tab]}
        </code>
      </pre>

      {/* Dashboard Status Footer */}
      <div className="exporter-footer">
        <div className="status-group">
          <div className={`status-dot ${hasData ? 'calibrated' : 'waiting'}`} />
          <span className={`status-text ${hasData ? 'calibrated' : 'waiting'}`}>
            {hasData ? "SYSTEM SIMULATED" : "AWAITING SIMULATION DATA"}
          </span>
        </div>
        
        <div className="footer-metrics">
          {hasData && (
            <span>
              Total Dataset: <span className="metric-highlight">{totalPoints.toLocaleString()} points</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}