package com.shooting_simulator.simulation.optimal;

import com.shooting_simulator.simulation.CostWeights;
import com.shooting_simulator.simulation.PhysicalValues;
import com.shooting_simulator.simulation.Trajectory;
import com.shooting_simulator.simulation.TrajectoryBuilder;
import com.shooting_simulator.util.math.geometry.Rotation2d;
import com.shooting_simulator.util.math.geometry.Translation2d;
import lombok.Getter;

@Getter
public class TrajectoryCouple {

    // Scale constants
    private static final double SCALE_VELOCITY = 0.1;
    private static final double SCALE_TIME = 1.0;
    private static final double SCALE_ANGLE = 0.04;

    // A massive multiplier to ensure the Safety Ratio absolutely dominates the search algorithm
    private static final double SCALE_SAFETY_RATIO = 1;

    private final Trajectory closeTrajectory;
    private final Trajectory farTrajectory;
    private final Trajectory optimalTrajectory;

    private final PhysicalValues physicalValues;

    private final double velocitySafetyRatio;
    private final double angleSafetyRatio;
    private final double overallSafetyRatio;

    public TrajectoryCouple(Trajectory closeTrajectory, Trajectory farTrajectory, TrajectoryBuilder centerBuilder, TrajectoryBuilder closeBuilder, TrajectoryBuilder farBuilder, PhysicalValues physicalValues) {
        this.closeTrajectory = closeTrajectory;
        this.farTrajectory = farTrajectory;

        this.physicalValues = physicalValues;

        Translation2d closeVelocity = closeTrajectory.getInitialShootingVelocity();
        Translation2d farVelocity = farTrajectory.getInitialShootingVelocity();

        // They share the exact same angle during the sweep
        Rotation2d sharedAngle = closeVelocity.getAngle();
        double midVelocity = (farVelocity.getNorm() + closeVelocity.getNorm()) / 2.0;

        this.optimalTrajectory = centerBuilder.simulateTrajectory(
                midVelocity,
                sharedAngle,
                true,
                closeTrajectory.isFlat());

        // Calculate Velocity Safety Ratio (Height of the Ellipse Fit)
        double velocityMargin = (farVelocity.getNorm() - closeVelocity.getNorm()) / 2.0;
        this.velocitySafetyRatio = velocityMargin / physicalValues.estimatedVelocityError;

        // Calculate Angle Safety Ratio (Width of the Ellipse Fit)
        double angleMargin = calculateAngleMargin(closeBuilder, farBuilder, midVelocity, sharedAngle.getDegrees(), closeTrajectory.isFlat());
        this.angleSafetyRatio = angleMargin / physicalValues.estimatedAngleError;

        // The Min Function: Define the shot purely by its weakest link
        this.overallSafetyRatio = Math.min(this.velocitySafetyRatio, this.angleSafetyRatio);
    }

    /**
     * Steps outward from the center angle to find exactly how far the robot
     * can rotate before the current vMid speed misses the physical target.
     */
    private double calculateAngleMargin(TrajectoryBuilder closeBuilder, TrajectoryBuilder farBuilder, double vMid, double centerAngle, boolean isFlat) {
        double step = 0.25; // Quarter-degree resolution is extremely fast and precise enough
        double maxAngle = centerAngle;
        double minAngle = centerAngle;

        // Search upwards
        while (maxAngle < this.physicalValues.maxAngle && isVelocitySafeAtAngle(closeBuilder, farBuilder, vMid, maxAngle + step, isFlat)) {
            maxAngle += step;
        }

        // Search downwards
        while (minAngle > this.physicalValues.minAngle && isVelocitySafeAtAngle(closeBuilder, farBuilder, vMid, minAngle - step, isFlat)) {
            minAngle -= step;
        }

        return (maxAngle - minAngle) / 2.0;
    }

    private boolean isVelocitySafeAtAngle(TrajectoryBuilder closeBuilder, TrajectoryBuilder farBuilder, double testVelocity, double testAngle, boolean isFlat) {
        Trajectory newClose = closeBuilder.findTrajectoryForAngle(testAngle, isFlat);
        Trajectory newFar = farBuilder.findTrajectoryForAngle(testAngle, isFlat);

        // If either boundary is physically impossible at this new angle, the shot fails
        if (newClose == null || !newClose.isHitTarget() || newFar == null || !newFar.isHitTarget()) return false;

        double requiredMin = newClose.getInitialShootingVelocity().getNorm();
        double requiredMax = newFar.getInitialShootingVelocity().getNorm();

        // The test velocity is only safe if it sits between the new boundary requirements
        return testVelocity >= requiredMin && testVelocity <= requiredMax;
    }

    /**
     * Calculates the true real-world cost of a trajectory based on multi-objective weights.
     * Lower cost is better.
     */
    public double getCost(CostWeights costWeights) {
        if (this.optimalTrajectory == null) {
            return 1000.0; // Miss penalty
        }

        // If safety ratio is < 1.0, the hardware error ellipse does not fit. Treat as a miss.
        if (this.overallSafetyRatio < 1.0) {
            return 500.0;
        }

        // We use a NEGATIVE safety ratio.
        // Because the Golden Section Search seeks the lowest possible number,
        // returning a massively negative number rewards the algorithm for finding the safest spot.
        double robustPenalty = -this.overallSafetyRatio * SCALE_SAFETY_RATIO;

        // Effort (Normalized: 10 m/s -> 1.0 baseline penalty)
        double initialVelPenalty = this.optimalTrajectory.getInitialShootingVelocity().getNorm() * SCALE_VELOCITY;

        // Impact Dynamics (Normalized)
        double impactVelPenalty = this.optimalTrajectory.getHitSample().getVelocity().getNorm() * SCALE_VELOCITY;
        double timeOfFlightPenalty = this.optimalTrajectory.getHitSample().getTime() * SCALE_TIME;

        // Entry Angle (Normalized: 20 degrees off -> 1.0 baseline penalty)
        Rotation2d impactAngle = this.optimalTrajectory.getHitSample().getVelocity().getAngle();
        double rawAngleError = Math.abs(impactAngle.getDegrees() - costWeights.targetImpactAngle());
        double entryAnglePenalty = rawAngleError * SCALE_ANGLE;

        // Apply UI weights and sum
        return (robustPenalty * costWeights.robustnessWeight()) +
                (initialVelPenalty * costWeights.initialVelocityWeight()) +
                (impactVelPenalty * costWeights.impactVelocityWeight()) +
                (timeOfFlightPenalty * costWeights.timeOfFlightWeight()) +
                (entryAnglePenalty * costWeights.entryAngleWeight());
    }
}