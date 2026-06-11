import MultivariateLinearRegression from "ml-regression-multivariate-linear";
import { useMemo, useState } from "react";
import "./CodeExporter.css"; // IMPORTANT: Import the new CSS file
import { TARGET_VARIABLES, VAR_KEYS } from "./shooterConfig";
import type { SharedConfig } from "../types";

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
  sharedConfig: SharedConfig;
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

    // --- Tolerance Sweet Spot ---
    private final double velToleranceMinus;
    private final double velTolerancePlus;
    private final double angleToleranceMinus;
    private final double angleTolerancePlus;
    private final double ellipseAngleDegrees;

    public Translation3d getTranslation3d() {
        return new Translation3d(this.velocity,
                new Rotation3d(0, -this.pitch.getRadians(), this.yaw.getRadians()));
    }
}`;
}

function buildAbstractModelCode(): string {
  // Dynamically generate standard getters and optional derivative methods
  let abstractMethods = "";

  for (const key of VAR_KEYS) {
    const config = TARGET_VARIABLES[key];
    const Name = key.charAt(0).toUpperCase() + key.slice(1);
    const hasDerivatives = !!config.derivative;

    abstractMethods += `
    // =========================================================================
    // ${config.name.toUpperCase()} TARGETS
    // =========================================================================
`;

    if (config.isBoundaryAxis) {
      abstractMethods += `
    public abstract double get${Name}(double distanceMeters, double radialVelocityMps);`;
      
      if (hasDerivatives) {
        abstractMethods += `
    public abstract double get${Name}DerivativeDistance(double distanceMeters, double radialVelocityMps);
    public abstract double get${Name}DerivativeRadialVelocity(double distanceMeters, double radialVelocityMps);`;
      }
      abstractMethods += `\n`;
    } else {
      abstractMethods += `
    public abstract double get${Name}Normal(double distanceMeters, double radialVelocityMps);
    public abstract double get${Name}MinAngle(double distanceMeters, double radialVelocityMps);
    public abstract double get${Name}MaxAngle(double distanceMeters, double radialVelocityMps);

    public double get${Name}(double angle, double distanceMeters, double radialVelocityMps) {
        if (angle <= getMinAngle()) return get${Name}MinAngle(distanceMeters, radialVelocityMps);
        if (angle >= getMaxAngle()) return get${Name}MaxAngle(distanceMeters, radialVelocityMps);
        return get${Name}Normal(distanceMeters, radialVelocityMps);
    }`;

      if (hasDerivatives) {
        abstractMethods += `

    public abstract double get${Name}NormalDerivativeDistance(double distanceMeters, double radialVelocityMps);
    public abstract double get${Name}MinAngleDerivativeDistance(double distanceMeters, double radialVelocityMps);
    public abstract double get${Name}MaxAngleDerivativeDistance(double distanceMeters, double radialVelocityMps);

    public double get${Name}DerivativeDistance(double angle, double distanceMeters, double radialVelocityMps) {
        if (angle <= getMinAngle()) return get${Name}MinAngleDerivativeDistance(distanceMeters, radialVelocityMps);
        if (angle >= getMaxAngle()) return get${Name}MaxAngleDerivativeDistance(distanceMeters, radialVelocityMps);
        return get${Name}NormalDerivativeDistance(distanceMeters, radialVelocityMps);
    }

    public abstract double get${Name}NormalDerivativeRadialVelocity(double distanceMeters, double radialVelocityMps);
    public abstract double get${Name}MinAngleDerivativeRadialVelocity(double distanceMeters, double radialVelocityMps);
    public abstract double get${Name}MaxAngleDerivativeRadialVelocity(double distanceMeters, double radialVelocityMps);

    public double get${Name}DerivativeRadialVelocity(double angle, double distanceMeters, double radialVelocityMps) {
        if (angle <= getMinAngle()) return get${Name}MinAngleDerivativeRadialVelocity(distanceMeters, radialVelocityMps);
        if (angle >= getMaxAngle()) return get${Name}MaxAngleDerivativeRadialVelocity(distanceMeters, radialVelocityMps);
        return get${Name}NormalDerivativeRadialVelocity(distanceMeters, radialVelocityMps);
    }`;
      }
      abstractMethods += `\n`;
    }
  }

  let code = `${BASE_PACKAGE}

import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Translation2d;

/**
 * Abstract base class for auto-generated shooter kinematics models.
 * Calculates positional targets and feedforward time-derivatives for shooting on the move.
 */
public abstract class ShootingModel {

    /** @return The maximum physical pitch angle of the shooter pivot. */
    protected abstract double getMaxAngle();

    /** @return The minimum physical pitch angle of the shooter pivot. */
    protected abstract double getMinAngle();

    /** @return The target radius in meters. */
    protected abstract double getTargetRadius();
${abstractMethods}
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
            Translation2d originVelocity,
            Translation2d originAcceleration,
            Translation2d target
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
        double flightTimeSeconds = getFlightTime(pitchDegrees, distanceMeters, radialVelocityMps);

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
    // TOLERANCE
    // =========================================================================
    
    /**
     * Evaluates if the current physical shooter state will hit the target based on the generated kinematics.
     * * @param pitch The current physical pitch of the pivot.
     * @param yaw The current physical yaw of the robot/turret.
     * @param velocity The current physical velocity of the flywheels.
     * @param origin The current global position of the robot.
     * @param target The global position of the target.
     * @param originVelocity The current global velocity vector of the robot.
     * @param targetRadiusMeters The physical radius of the target minus the game piece radius.
     * @return True if the shot falls within all mathematical tolerance bounds.
     */
    public boolean willHitTarget(
            Rotation2d pitch,
            Rotation2d yaw,
            double velocity,
            Translation2d origin,
            Translation2d originVelocity,
            Translation2d target,
            double targetRadiusMeters
    ) {
        // Calculate Base Spatial State
        double distanceMeters = origin.getDistance(target);
        Translation2d decomposedVelocity = decomposeVelocity(origin, target, originVelocity);

        double radialVelocityMps = decomposedVelocity.getX();
        double tangentialVelocityMps = decomposedVelocity.getY();

        // Evaluate both sub-tolerances
        return isPitchAndVelocityInTolerance(pitch, velocity, distanceMeters, radialVelocityMps) &&
                isYawInTolerance(pitch, yaw, origin, target, distanceMeters, radialVelocityMps, tangentialVelocityMps, targetRadiusMeters);
    }

    private boolean isYawInTolerance(
            Rotation2d pitch,
            Rotation2d yaw,
            Translation2d origin,
            Translation2d target,
            double distanceMeters,
            double radialVelocityMps,
            double tangentialVelocityMps,
            double targetRadiusMeters
    ) {
        // Get flight time to calculate expected lateral drift
        double flightTimeSeconds = getFlightTime(pitch.getDegrees(), distanceMeters, radialVelocityMps);

        // Calculate ideal upstream yaw to cancel tangential momentum
        Rotation2d angleToTarget = target.minus(origin).getAngle();
        Translation2d lateralDrift = new Translation2d(0, tangentialVelocityMps * flightTimeSeconds).rotateBy(angleToTarget);

        Translation2d effectiveTarget = target.minus(lateralDrift);
        Rotation2d idealYaw = effectiveTarget.minus(origin).getAngle();

        // Calculate how much angular error is allowed by the physical target width
        // Using atan2 effectively builds a cone originating from the robot's lens to the edges of the target.
        double allowedYawErrorRad = Math.atan2(targetRadiusMeters, distanceMeters);

        // Compare actual vs ideal
        return Math.abs(yaw.minus(idealYaw).getRadians()) <= allowedYawErrorRad;
    }

    private boolean isPitchAndVelocityInTolerance(Rotation2d pitch, double velocity, double distanceMeters, double radialVelocityMps) {
        // Calculate the exact center of the sweet spot for this distance
        double idealPitchDeg = getAngle(distanceMeters, radialVelocityMps);
        double idealVelocity = getVelocity(idealPitchDeg, distanceMeters, radialVelocityMps);

        // Fetch the tolerance bounds (the size and tilt of the ellipse)
        double velTolMinus = getToleranceVelNegative(idealPitchDeg, distanceMeters, radialVelocityMps);
        double velTolPlus = getToleranceVelPositive(idealPitchDeg, distanceMeters, radialVelocityMps);
        double angleTolMinus = getToleranceAngleNegative(idealPitchDeg, distanceMeters, radialVelocityMps);
        double angleTolPlus = getToleranceAnglePositive(idealPitchDeg, distanceMeters, radialVelocityMps);
        double ellipseAngleRad = Math.toRadians(getToleranceEllipseAngle(idealPitchDeg, distanceMeters, radialVelocityMps));

        // Calculate how far off we are from the ideal center
        double deltaVel = velocity - idealVelocity;
        double deltaPitch = pitch.getDegrees() - idealPitchDeg;

        // Rotate our deltas to align with the tilted axes of the ellipse
        double cosA = Math.cos(ellipseAngleRad);
        double sinA = Math.sin(ellipseAngleRad);

        double xAligned = (deltaVel * cosA) + (deltaPitch * sinA);
        double yAligned = -(deltaVel * sinA) + (deltaPitch * cosA);

        // Select the correct asymmetric bounds depending on which quadrant we are in
        double rx = (xAligned > 0) ? velTolPlus : velTolMinus;
        double ry = (yAligned > 0) ? angleTolPlus : angleTolMinus;

        // Prevent division by zero if bounds are perfectly zero
        if (rx <= 0.0001 || ry <= 0.0001) {
            return false;
        }

        // Evaluate the core ellipse equation
        return Math.pow(xAligned / rx, 2) + Math.pow(yAligned / ry, 2) <= 1.0;
    }

    // =========================================================================
    // INTERNAL KINEMATICS HELPERS
    // =========================================================================

    private double getPitchVelocity(double distanceMeters, double radialVelocityMps, double radialAccelerationMpsSq) {
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
     * X = Radial component (Negative = towards target, Positive = away).
     * Y = Tangential component (Positive = strafing left, Negative = strafing right).
     */
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

  return code;
}

function buildGeneratedCode(models: any, sharedConfig: SharedConfig, totalPoints: number): string {
  const hasData = !!models.normal;
  const getEq = (m: any, d: number | null) => hasData ? generateEquation(m, d) : "0.0";
  const getD1 = (m: any, d: number | null, v: 'd' | 'vr') => hasData ? generateDerivativeEquation(m, d, v) : "0.0";

  // Note: Adjust the 'sharedConfig.resolution' mapping below if your resolution 
  // property has a different name (like sharedConfig.simulation.distanceResolution)
  const resolutionDisplay = sharedConfig.resolutionMode ?? "Unknown";

  let javaCode = `${BASE_PACKAGE}

// THIS FILE IS AUTO-GENERATED BY THE SHOOTER SIMULATOR. DO NOT EDIT MANUALLY.
//
// Dataset Statistics:
// - Total Simulated Points: ${totalPoints.toLocaleString()}
// - Simulator Resolution:   ${resolutionDisplay}
//
public class GeneratedShooterModel extends ShootingModel {

    @Override
    protected double getMinAngle() { return ${sharedConfig.hardware.minAngle}; }

    @Override
    protected double getMaxAngle() { return ${sharedConfig.hardware.maxAngle}; }

    @Override
    protected double getTargetRadius() { return ${sharedConfig.target.radius}; }
`;

  // Dynamically generate all kinematic equations based on VAR_KEYS
  for (const key of VAR_KEYS) {
    const config = TARGET_VARIABLES[key];
    const Name = key.charAt(0).toUpperCase() + key.slice(1);
    const hasDerivatives = !!config.derivative;
    
    javaCode += `\n    // === ${config.name.toUpperCase()} TARGETS ===\n`;

    if (config.isBoundaryAxis) {
      javaCode += `
    @Override
    public double get${Name}(double d, double vr) {
        return ${getEq(models.normal?.models[key], models.normal?.degrees[key])};
    }`;

      if (hasDerivatives) {
        javaCode += `
    @Override
    public double get${Name}DerivativeDistance(double d, double vr) {
        return ${getD1(models.normal?.models[key], models.normal?.degrees[key], 'd')};
    }
    @Override
    public double get${Name}DerivativeRadialVelocity(double d, double vr) {
        return ${getD1(models.normal?.models[key], models.normal?.degrees[key], 'vr')};
    }`;
      }
      javaCode += `\n`;
    } else {
      const regimes = ['Normal', 'MinAngle', 'MaxAngle'] as const;
      const modelKeys = ['normal', 'min', 'max'] as const;

      for (let i = 0; i < regimes.length; i++) {
        const r = regimes[i];
        const mk = modelKeys[i];
        javaCode += `
    @Override
    public double get${Name}${r}(double d, double vr) {
        return ${getEq(models[mk]?.models[key], models[mk]?.degrees[key])};
    }`;

        if (hasDerivatives) {
          javaCode += `
    @Override
    public double get${Name}${r}DerivativeDistance(double d, double vr) {
        return ${getD1(models[mk]?.models[key], models[mk]?.degrees[key], 'd')};
    }
    @Override
    public double get${Name}${r}DerivativeRadialVelocity(double d, double vr) {
        return ${getD1(models[mk]?.models[key], models[mk]?.degrees[key], 'vr')};
    }`;
        }
        javaCode += `\n`;
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
  sharedConfig,
  datasetCounts,
}: Props) {
  const [tab, setTab] = useState<Tab>("generated");
  const [copied, setCopied] = useState(false);
  
  const hasData = !!models.normal;

  // Calculate total points here so we can pass it into the code generator
  const totalPoints = (datasetCounts?.normal ?? 0) + (datasetCounts?.min ?? 0) + (datasetCounts?.max ?? 0);

  const codes = useMemo(() => ({
    preset: buildPresetCode(),
    model: buildAbstractModelCode(),
    generated: buildGeneratedCode(models, sharedConfig, totalPoints),
  }), [models, sharedConfig, totalPoints]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codes[tab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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