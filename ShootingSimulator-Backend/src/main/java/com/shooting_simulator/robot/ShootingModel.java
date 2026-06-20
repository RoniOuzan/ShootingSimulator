package com.shooting_simulator.robot;

import com.shooting_simulator.util.math.geometry.Rotation2d;
import com.shooting_simulator.util.math.geometry.Translation2d;

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

    // =========================================================================
    // OPTIMAL ANGLE TARGETS
    // =========================================================================

    public abstract double getAngle(double distanceMeters, double radialVelocityMps);
    public abstract double getAngleDerivativeDistance(double distanceMeters, double radialVelocityMps);
    public abstract double getAngleDerivativeRadialVelocity(double distanceMeters, double radialVelocityMps);

    // =========================================================================
    // OPTIMAL VELOCITY TARGETS
    // =========================================================================

    public abstract double getVelocityNormal(double distanceMeters, double radialVelocityMps);
    public abstract double getVelocityMinAngle(double distanceMeters, double radialVelocityMps);
    public abstract double getVelocityMaxAngle(double distanceMeters, double radialVelocityMps);

    public double getVelocity(double angle, double distanceMeters, double radialVelocityMps) {
        if (angle <= getMinAngle()) return getVelocityMinAngle(distanceMeters, radialVelocityMps);
        if (angle >= getMaxAngle()) return getVelocityMaxAngle(distanceMeters, radialVelocityMps);
        return getVelocityNormal(distanceMeters, radialVelocityMps);
    }

    public abstract double getVelocityNormalDerivativeDistance(double distanceMeters, double radialVelocityMps);
    public abstract double getVelocityMinAngleDerivativeDistance(double distanceMeters, double radialVelocityMps);
    public abstract double getVelocityMaxAngleDerivativeDistance(double distanceMeters, double radialVelocityMps);

    public double getVelocityDerivativeDistance(double angle, double distanceMeters, double radialVelocityMps) {
        if (angle <= getMinAngle()) return getVelocityMinAngleDerivativeDistance(distanceMeters, radialVelocityMps);
        if (angle >= getMaxAngle()) return getVelocityMaxAngleDerivativeDistance(distanceMeters, radialVelocityMps);
        return getVelocityNormalDerivativeDistance(distanceMeters, radialVelocityMps);
    }

    public abstract double getVelocityNormalDerivativeRadialVelocity(double distanceMeters, double radialVelocityMps);
    public abstract double getVelocityMinAngleDerivativeRadialVelocity(double distanceMeters, double radialVelocityMps);
    public abstract double getVelocityMaxAngleDerivativeRadialVelocity(double distanceMeters, double radialVelocityMps);

    public double getVelocityDerivativeRadialVelocity(double angle, double distanceMeters, double radialVelocityMps) {
        if (angle <= getMinAngle()) return getVelocityMinAngleDerivativeRadialVelocity(distanceMeters, radialVelocityMps);
        if (angle >= getMaxAngle()) return getVelocityMaxAngleDerivativeRadialVelocity(distanceMeters, radialVelocityMps);
        return getVelocityNormalDerivativeRadialVelocity(distanceMeters, radialVelocityMps);
    }

    // =========================================================================
    // FLIGHT TIME TARGETS
    // =========================================================================

    public abstract double getFlightTimeNormal(double distanceMeters, double radialVelocityMps);
    public abstract double getFlightTimeMinAngle(double distanceMeters, double radialVelocityMps);
    public abstract double getFlightTimeMaxAngle(double distanceMeters, double radialVelocityMps);

    public double getFlightTime(double angle, double distanceMeters, double radialVelocityMps) {
        if (angle <= getMinAngle()) return getFlightTimeMinAngle(distanceMeters, radialVelocityMps);
        if (angle >= getMaxAngle()) return getFlightTimeMaxAngle(distanceMeters, radialVelocityMps);
        return getFlightTimeNormal(distanceMeters, radialVelocityMps);
    }

    // =========================================================================
    // POS VELOCITY TOLERANCE TARGETS
    // =========================================================================

    public abstract double getToleranceVelPositiveNormal(double distanceMeters, double radialVelocityMps);
    public abstract double getToleranceVelPositiveMinAngle(double distanceMeters, double radialVelocityMps);
    public abstract double getToleranceVelPositiveMaxAngle(double distanceMeters, double radialVelocityMps);

    public double getToleranceVelPositive(double angle, double distanceMeters, double radialVelocityMps) {
        if (angle <= getMinAngle()) return getToleranceVelPositiveMinAngle(distanceMeters, radialVelocityMps);
        if (angle >= getMaxAngle()) return getToleranceVelPositiveMaxAngle(distanceMeters, radialVelocityMps);
        return getToleranceVelPositiveNormal(distanceMeters, radialVelocityMps);
    }

    // =========================================================================
    // NEG VELOCITY TOLERANCE TARGETS
    // =========================================================================

    public abstract double getToleranceVelNegativeNormal(double distanceMeters, double radialVelocityMps);
    public abstract double getToleranceVelNegativeMinAngle(double distanceMeters, double radialVelocityMps);
    public abstract double getToleranceVelNegativeMaxAngle(double distanceMeters, double radialVelocityMps);

    public double getToleranceVelNegative(double angle, double distanceMeters, double radialVelocityMps) {
        if (angle <= getMinAngle()) return getToleranceVelNegativeMinAngle(distanceMeters, radialVelocityMps);
        if (angle >= getMaxAngle()) return getToleranceVelNegativeMaxAngle(distanceMeters, radialVelocityMps);
        return getToleranceVelNegativeNormal(distanceMeters, radialVelocityMps);
    }

    // =========================================================================
    // POS ANGLE TOLERANCE TARGETS
    // =========================================================================

    public abstract double getToleranceAnglePositiveNormal(double distanceMeters, double radialVelocityMps);
    public abstract double getToleranceAnglePositiveMinAngle(double distanceMeters, double radialVelocityMps);
    public abstract double getToleranceAnglePositiveMaxAngle(double distanceMeters, double radialVelocityMps);

    public double getToleranceAnglePositive(double angle, double distanceMeters, double radialVelocityMps) {
        if (angle <= getMinAngle()) return getToleranceAnglePositiveMinAngle(distanceMeters, radialVelocityMps);
        if (angle >= getMaxAngle()) return getToleranceAnglePositiveMaxAngle(distanceMeters, radialVelocityMps);
        return getToleranceAnglePositiveNormal(distanceMeters, radialVelocityMps);
    }

    // =========================================================================
    // NEG ANGLE TOLERANCE TARGETS
    // =========================================================================

    public abstract double getToleranceAngleNegativeNormal(double distanceMeters, double radialVelocityMps);
    public abstract double getToleranceAngleNegativeMinAngle(double distanceMeters, double radialVelocityMps);
    public abstract double getToleranceAngleNegativeMaxAngle(double distanceMeters, double radialVelocityMps);

    public double getToleranceAngleNegative(double angle, double distanceMeters, double radialVelocityMps) {
        if (angle <= getMinAngle()) return getToleranceAngleNegativeMinAngle(distanceMeters, radialVelocityMps);
        if (angle >= getMaxAngle()) return getToleranceAngleNegativeMaxAngle(distanceMeters, radialVelocityMps);
        return getToleranceAngleNegativeNormal(distanceMeters, radialVelocityMps);
    }

    // =========================================================================
    // ELLIPSE ANGLE TOLERANCE TARGETS
    // =========================================================================

    public abstract double getToleranceEllipseAngleNormal(double distanceMeters, double radialVelocityMps);
    public abstract double getToleranceEllipseAngleMinAngle(double distanceMeters, double radialVelocityMps);
    public abstract double getToleranceEllipseAngleMaxAngle(double distanceMeters, double radialVelocityMps);

    public double getToleranceEllipseAngle(double angle, double distanceMeters, double radialVelocityMps) {
        if (angle <= getMinAngle()) return getToleranceEllipseAngleMinAngle(distanceMeters, radialVelocityMps);
        if (angle >= getMaxAngle()) return getToleranceEllipseAngleMaxAngle(distanceMeters, radialVelocityMps);
        return getToleranceEllipseAngleNormal(distanceMeters, radialVelocityMps);
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
     *         X = Radial component (Negative = towards target, Positive = away).
     *         Y = Tangential component (Positive = strafing left, Negative = strafing right).
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
}