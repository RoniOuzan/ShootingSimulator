package com.shooting_simulator.simulation.optimal;

import com.shooting_simulator.simulation.*;
import com.shooting_simulator.simulation.resolution.OptimalResolution;
import com.shooting_simulator.util.math.MathUtil;
import com.shooting_simulator.util.math.geometry.Rotation2d;
import com.shooting_simulator.util.math.geometry.Translation2d;
import lombok.Getter;

@Getter
public class TrajectoryCouple {

    // Scale constants
    private static final double SCALE_VELOCITY = 0.1;
    private static final double SCALE_TIME = 1.0;
    private static final double SCALE_ANGLE = 0.01;

    // Calibrated Robustness Constants
    private static final double VELOCITY_SIGMA = 0.3;
    private static final double ANGLE_SIGMA = 1.5;

    private static final double VELOCITY_BIAS = 0.5;

    private final Trajectory closeTrajectory;
    private final Trajectory farTrajectory;
    private final Trajectory optimalTrajectory;

    private final TrajectoryBuilder closeBuilder;
    private final TrajectoryBuilder farBuilder;

    private final PhysicalValues physicalValues;
    private final double velocityGap;
    private final double gapDerivative;

    private final OptimalResolution resolution;

    public TrajectoryCouple(Trajectory closeTrajectory, Trajectory farTrajectory, TrajectoryBuilder centerBuilder, TrajectoryBuilder closeBuilder, TrajectoryBuilder farBuilder, PhysicalValues physicalValues, OptimalResolution resolution) {
        this.closeTrajectory = closeTrajectory;
        this.farTrajectory = farTrajectory;
        this.physicalValues = physicalValues;

        this.closeBuilder = closeBuilder;
        this.farBuilder = farBuilder;

        this.resolution = resolution;

        Translation2d closeVelocity = closeTrajectory.getInitialShootingVelocity();
        Translation2d farVelocity = farTrajectory.getInitialShootingVelocity();
        Rotation2d sharedAngle = closeVelocity.getAngle();

        this.velocityGap = farVelocity.getNorm() - closeVelocity.getNorm();
        this.gapDerivative = calculateGapDerivative(sharedAngle.getDegrees(), closeTrajectory.isFlat());

        this.optimalTrajectory = getOptimalTrajectory(centerBuilder);
    }

    private Trajectory getOptimalTrajectory(TrajectoryBuilder centerBuilder) {
        Translation2d closeVelocity = this.closeTrajectory.getInitialShootingVelocity();
        double targetVelocity = closeVelocity.getNorm() + (this.velocityGap * VELOCITY_BIAS);

        return centerBuilder.simulateTrajectory(
                targetVelocity,
                closeVelocity.getAngle(),
                true,
                this.closeTrajectory.isFlat());
    }

    public double getCost(CostWeights costWeights) {
        if (this.optimalTrajectory == null) {
            return 1000.0;
        }

        double robustnessPenalty = 1.0 / (Math.hypot(this.getVelocityRobustnessCost(), this.getAngleRobustnessCost()) + 1e-6);
        double initialVelPenalty = this.optimalTrajectory.getInitialShootingVelocity().getNorm() * SCALE_VELOCITY;
        double impactVelPenalty = this.optimalTrajectory.getHitSample().getVelocity().getNorm() * SCALE_VELOCITY;
        double timeOfFlightPenalty = this.optimalTrajectory.getHitSample().getTime() * SCALE_TIME;

        Rotation2d impactAngle = this.optimalTrajectory.getHitSample().getVelocity().getAngle();
        double rawAngleError = Math.abs(impactAngle.getDegrees() - costWeights.targetImpactAngle());
        double entryAnglePenalty = rawAngleError * SCALE_ANGLE;

        return (robustnessPenalty * costWeights.robustnessWeight()) +
                (initialVelPenalty * costWeights.initialVelocityWeight()) +
                (impactVelPenalty * costWeights.impactVelocityWeight()) +
                (timeOfFlightPenalty * costWeights.timeOfFlightWeight()) +
                (entryAnglePenalty * costWeights.entryAngleWeight());
    }

    public void calculateTolerance() {
        double optAngle = this.optimalTrajectory.getInitialShootingVelocity().getAngle().getDegrees();
        double optVel = this.optimalTrajectory.getInitialShootingVelocity().getNorm();
        boolean isFlat = this.optimalTrajectory.isFlat();

        double slope = calculateOptimalDerivative(optAngle, isFlat);
        double ellipseAngleRad = Math.atan(slope);
        double ellipseAngleDeg = Math.toDegrees(ellipseAngleRad);

        // Find the absolute maximum width along the center axis
        double maxPosAngle = calculateAngleTolerance(optAngle, optVel, slope, isFlat, true);
        double maxNegAngle = calculateAngleTolerance(optAngle, optVel, slope, isFlat, false);

        // Set the height (velocity) bounds based on your optimal point
        double velPos = this.velocityGap * (1 - VELOCITY_BIAS) * Math.cos(ellipseAngleRad); // times cos because its angled and the velocityGap is the fixed vertical height
        double velNeg = this.velocityGap * VELOCITY_BIAS * Math.cos(ellipseAngleRad);

        double safeScale = 1.0;
        while (safeScale > 0.1 && !isEllipseSafe(safeScale, optAngle, optVel, maxNegAngle, maxPosAngle, velPos, velNeg, ellipseAngleRad, isFlat)) {
            safeScale -= 0.05;
        }

        this.optimalTrajectory.setTolerance(new Tolerance(
                velPos,
                velNeg,
                maxPosAngle * safeScale,
                maxNegAngle * safeScale,
                ellipseAngleDeg));
    }

    /**
     * Numerically searches outward along the ellipse's major axis to find the maximum angle width.
     */
    private double calculateAngleTolerance(double optAngle, double optVel, double slope, boolean isFlat, boolean positive) {
        double step = 0.1; // Resolution of the search in degrees
        double maxSearch = 10.0; // Failsafe maximum search width (degrees)
        double currentDelta = 0.0;

        while (currentDelta < maxSearch) {
            currentDelta += step;
            double deltaAngle = positive ? currentDelta : -currentDelta;
            double testAngle = optAngle + deltaAngle;

            // Calculate the velocity along the rotated center axis of the ellipse
            double testVel = optVel + (deltaAngle * slope);

            // Fetch upper and lower bounds at this new test angle
            Trajectory closeTraj = this.closeBuilder.findTrajectoryForAngle(testAngle, isFlat, false);
            Trajectory farTraj = this.farBuilder.findTrajectoryForAngle(testAngle, isFlat, false);

            // Check if we hit a mechanical limit (impossible shot)
            if (closeTraj == null || farTraj == null || !closeTraj.isHitTarget() || !farTraj.isHitTarget()) {
                break;
            }

            double lowerVelBound = closeTraj.getInitialShootingVelocity().getNorm();
            double upperVelBound = farTraj.getInitialShootingVelocity().getNorm();

            // If our ellipse's center axis crosses the red or green curves, the basin ends here
            if (testVel <= lowerVelBound || testVel >= upperVelBound) {
                break;
            }
        }

        // Return the last valid width, ensuring it never goes negative
        return Math.max(0, currentDelta - step);
    }

    private boolean isEllipseSafe(double scale, double optAngle, double optVel,
                                  double leftWidth, double rightWidth,
                                  double velLow, double velHigh,
                                  double ellipseAngleRad, boolean isFlat) {
        int numSamples = 36;

        for (int i = 0; i < numSamples; i++) {
            double t = (2 * Math.PI * i) / numSamples;

            // FIX: Apply scale to BOTH width (a) and height (b) so the entire shape tucks in
            double a = (Math.cos(t) > 0) ? (rightWidth * scale) : (leftWidth * scale);
            double b = (Math.sin(t) > 0) ? (velHigh * scale) : (velLow * scale);

            double dx = a * Math.cos(t);
            double dy = b * Math.sin(t);

            double rotDx = dx * Math.cos(ellipseAngleRad) - dy * Math.sin(ellipseAngleRad);
            double rotDy = dx * Math.sin(ellipseAngleRad) + dy * Math.cos(ellipseAngleRad);

            double testAngle = optAngle + rotDx;
            double testVel = optVel + rotDy;

            Trajectory closeTraj = this.closeBuilder.findTrajectoryForAngle(testAngle, isFlat, false);
            Trajectory farTraj = this.farBuilder.findTrajectoryForAngle(testAngle, isFlat, false);

            if (closeTraj == null || farTraj == null || !closeTraj.isHitTarget() || !farTraj.isHitTarget()) {
                return false;
            }

            double lowerBound = closeTraj.getInitialShootingVelocity().getNorm();
            double upperBound = farTraj.getInitialShootingVelocity().getNorm();

            if (testVel <= lowerBound || testVel >= upperBound) {
                return false;
            }
        }

        return true;
    }

    public double calculateVelocityGap(double angle, boolean isFlat) {
        Trajectory closeTraj = this.closeBuilder.findTrajectoryForAngle(angle, isFlat, false);
        Trajectory farTraj = this.farBuilder.findTrajectoryForAngle(angle, isFlat, false);

        // NULL CHECK: If a mechanical error pushes the shot into a wall, this angle is invalid.
        if (closeTraj == null || farTraj == null || !closeTraj.isHitTarget() || !farTraj.isHitTarget()) {
            return -100.0; // Instantly kills the robustness score for this angle
        }

        return farTraj.getInitialShootingVelocity().getNorm() - closeTraj.getInitialShootingVelocity().getNorm();
    }

    public double calculateOptimalDerivative(double angle, boolean isFlat) {
        double highWindow = getWindowAtAngle(angle + this.resolution.getAngleDX(), isFlat);

        return (highWindow - this.optimalTrajectory.getInitialShootingVelocity().getNorm()) / this.resolution.getAngleDX();
    }

    public double calculateGapDerivative(double angle, boolean isFlat) {
        double highGap = calculateVelocityGap(angle + this.resolution.getAngleDX(), isFlat);

        // Returns how many m/s the gap shrinks/grows per degree of pivot
        return (highGap - this.velocityGap) / this.resolution.getAngleDX();
    }

    /**
     * Safely calculates the velocity window at a given angle.
     * Returns a massive negative penalty if the angle results in an impossible shot.
     */
    private double getWindowAtAngle(double angle, boolean isFlat) {
        angle = MathUtil.clamp(angle, this.physicalValues.minAngle, this.physicalValues.maxAngle);
        Trajectory closeTraj = this.closeBuilder.findTrajectoryForAngle(angle, isFlat, false);
        Trajectory farTraj = this.farBuilder.findTrajectoryForAngle(angle, isFlat, false);

        // NULL CHECK: If a mechanical error pushes the shot into a wall, this angle is invalid.
        if (closeTraj == null || farTraj == null || !closeTraj.isHitTarget() || !farTraj.isHitTarget()) {
            return -100.0; // Instantly kills the robustness score for this angle
        }

        return closeTraj.getInitialShootingVelocity().getNorm() + ((farTraj.getInitialShootingVelocity().getNorm() - closeTraj.getInitialShootingVelocity().getNorm()) * VELOCITY_BIAS);
    }

    public double getVelocityRobustnessCost() {
        return this.velocityGap / VELOCITY_SIGMA;
    }

    public double getAngleRobustnessCost() {
        return Math.abs(this.velocityGap / (this.gapDerivative + 1e-6)) / ANGLE_SIGMA;
    }
}