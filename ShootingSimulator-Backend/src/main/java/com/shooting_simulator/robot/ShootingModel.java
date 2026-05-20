package com.shooting_simulator.robot;

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
        double pitchDegrees = getAngle(distanceMeters, radialVelocityMps);
        double flywheelVelocityMps = getVelocity(pitchDegrees, distanceMeters, radialVelocityMps);
        double flightTimeSeconds = getFlightTime(distanceMeters, radialVelocityMps);

        // Multivariable Chain Rule for Time Derivatives (d/dt)
        // dθ/dt = (∂θ/∂d * dd/dt) + (∂θ/∂v_r * dv_r/dt)
        double pitchVelDegPerSec = getPitchVelocity(distanceMeters, radialVelocityMps, radialAccelerationMpsSq);
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
                pitchVelDegPerSec,
                yawVelocityRadPerSec,
                flywheelAccelerationMpsSq,
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
}