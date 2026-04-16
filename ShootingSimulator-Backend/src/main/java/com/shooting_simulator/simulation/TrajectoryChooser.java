package com.shooting_simulator.simulation;

import com.shooting_simulator.Constants;
import com.shooting_simulator.util.math.geometry.Rotation2d;
import com.shooting_simulator.util.math.geometry.Translation2d;
import lombok.Getter;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Getter
public class TrajectoryChooser {

    private static final double MAX_EXIT_VELOCITY = 12;
    private static final double MIN_EXIT_VELOCITY = 6;
    private static final double EXIT_VELOCITY_DT = 0.1;

    private static final double MIN_ANGLE = 50;
    private static final double MAX_ANGLE = 80;
    private static final double ANGLE_DT = 0.5;

    private Translation2d initialPosition;
    private Translation2d target;
    private Translation2d targetTolerance;
    private double minHitAngle;
    private double maxHitAngle;

    private List<Trajectory> trajectories;
    private Trajectory bestTrajectory;

    public TrajectoryChooser(Translation2d initialPosition, Translation2d target, Translation2d targetTolerance, double minHitAngle, double maxHitAngle) {
        this.initialPosition = initialPosition;
        this.target = target;
        this.targetTolerance = targetTolerance;
        this.minHitAngle = minHitAngle;
        this.maxHitAngle = maxHitAngle;

        this.trajectories = this.calculateTrajectories();
        this.bestTrajectory = this.chooseBestTrajectory();
    }

    private Trajectory chooseBestTrajectory() {
        return this.trajectories.stream().max(Comparator.comparing(this::calculateTrajectoryCost)).orElse(null);
    }

    private double calculateTrajectoryCost(Trajectory trajectory) {
        return calculateExitVelocityOverErrorDerivative(trajectory) + calculateAngleOverErrorDerivative(trajectory);
    }

    private double calculateExitVelocityOverErrorDerivative(Trajectory trajectory) {
        double dv = EXIT_VELOCITY_DT / 10;

        Translation2d velocity = trajectory.getInitialSample().getVelocity();
        Trajectory before = this.simulateTrajectory(velocity.getNorm() - dv, velocity.getAngle());
        Trajectory after = this.simulateTrajectory(velocity.getNorm() + dv, velocity.getAngle());

        return (after.getErrorFromTarget(this.target) - before.getErrorFromTarget(this.target)) / (dv * 2);
    }

    private double calculateAngleOverErrorDerivative(Trajectory trajectory) {
        Rotation2d da = Rotation2d.fromDegrees(ANGLE_DT / 10);

        Translation2d velocity = trajectory.getInitialSample().getVelocity();
        Trajectory before = this.simulateTrajectory(velocity.getNorm(), velocity.getAngle().minus(da));
        Trajectory after = this.simulateTrajectory(velocity.getNorm(), velocity.getAngle().plus(da));

        return (after.getErrorFromTarget(this.target) - before.getErrorFromTarget(this.target)) / (da.getRadians() * 2);
    }

    private List<Trajectory> calculateTrajectories() {
        List<Trajectory> trajectories = new ArrayList<>();

        for (double angle = MIN_ANGLE; angle <= MAX_ANGLE; angle += ANGLE_DT) {
            for (double exitVelocity = MIN_EXIT_VELOCITY; exitVelocity <= MAX_EXIT_VELOCITY; exitVelocity += EXIT_VELOCITY_DT) {
                Trajectory trajectory = simulateTrajectory(exitVelocity, Rotation2d.fromDegrees(angle));

                if (hasHitTarget(trajectory)) {
                    trajectories.add(trajectory);
                }
            }
        }

        return trajectories;
    }

    // Extracted the core bounding box logic to a reusable helper
    private boolean isInsideTarget(Translation2d position, Translation2d velocity) {
        boolean withinXBounds = Math.abs(position.getX() - this.target.getX()) <= this.targetTolerance.getX();
        boolean withinYBounds = Math.abs(position.getY() - this.target.getY()) <= this.targetTolerance.getY();
        return withinXBounds && withinYBounds && isInHitAngleRange(velocity.getAngle());
    }

    private boolean hasHitTarget(Trajectory trajectory) {
        // Since we stop the simulation exactly when it hits,
        // the last sample will trigger this, but we iterate just to be safe.
        for (Sample sample : trajectory.getSamples()) {
            if (isInsideTarget(sample.getPosition(), sample.getVelocity())) {
                return true;
            }
        }
        return false;
    }

    private Trajectory simulateTrajectory(double exitVelocity, Rotation2d angle) {
        List<Sample> samples = new ArrayList<>();

        Translation2d position = this.initialPosition;
        Translation2d velocity = new Translation2d(exitVelocity, angle);
        samples.add(new Sample(position, velocity));

        while (shouldCalculateTrajectory(position, velocity)) {
            position = position.plus(velocity.times(Constants.PERIOD));
            velocity = velocity.plus(new Translation2d(0, Constants.GRAVITY).times(Constants.PERIOD));

            samples.add(new Sample(position, velocity));

            if (isInsideTarget(position, velocity)) {
                break;
            }
        }

        return new Trajectory(samples);
    }

    private boolean shouldCalculateTrajectory(Translation2d position, Translation2d velocity) {
        // Simulation ends if the projectile hits the floor
        if (position.getY() < 0) {
            return false;
        }

        // Simulation ends if it has flown completely past the back edge of the target
        if (position.getX() > this.target.getX() + this.targetTolerance.getX()) {
            return false;
        }

        // Simulation ends if it is falling AND has dropped completely below the bottom edge of the target
        if (velocity.getY() < 0 && position.getY() < this.target.getY() - this.targetTolerance.getY()) {
            return false;
        }
        // If none of the miss conditions are met, keep simulating
        return true;
    }

    private boolean isInHitAngleRange(Rotation2d angle) {
        return angle.getDegrees() >= this.minHitAngle && angle.getDegrees() <= this.maxHitAngle;
    }
}
