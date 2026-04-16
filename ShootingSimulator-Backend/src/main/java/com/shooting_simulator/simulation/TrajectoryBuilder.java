package com.shooting_simulator.simulation;

import com.shooting_simulator.Constants;
import com.shooting_simulator.util.math.geometry.Rotation2d;
import com.shooting_simulator.util.math.geometry.Translation2d;
import lombok.Getter;

import java.util.ArrayList;
import java.util.List;

@Getter
public class TrajectoryBuilder {
    public static final double PERIOD = 0.005;

    private final Translation2d initialPosition;
    private final Translation2d target;
    private final Translation2d targetTolerance;
    private final double minHitAngle;
    private final double maxHitAngle;

    public TrajectoryBuilder(Translation2d initialPosition, Translation2d target, Translation2d targetTolerance, double minHitAngle, double maxHitAngle) {
        this.initialPosition = initialPosition;
        this.target = target;
        this.targetTolerance = targetTolerance;
        this.minHitAngle = minHitAngle;
        this.maxHitAngle = maxHitAngle;
    }

    private boolean isInsideTarget(Translation2d position, Translation2d velocity) {
        boolean withinXBounds = Math.abs(position.getX() - this.target.getX()) <= this.targetTolerance.getX();
        boolean withinYBounds = Math.abs(position.getY() - this.target.getY()) <= this.targetTolerance.getY();
        return withinXBounds && withinYBounds && isInHitAngleRange(velocity.getAngle());
    }

    public boolean hasHitTarget(Trajectory trajectory) {
        for (Sample sample : trajectory.getSamples()) {
            if (isInsideTarget(sample.getPosition(), sample.getVelocity())) {
                return true;
            }
        }
        return false;
    }

    public Trajectory simulateTrajectory(double exitVelocity, Rotation2d angle) {
        List<Sample> samples = new ArrayList<>();

        Translation2d position = this.initialPosition;
        Translation2d velocity = new Translation2d(exitVelocity, angle);
        samples.add(new Sample(position, velocity));

        while (shouldCalculateTrajectory(position, velocity)) {
            Translation2d nextPosition = position.plus(velocity.times(PERIOD));
            Translation2d nextVelocity = velocity.plus(new Translation2d(0, Constants.GRAVITY).times(PERIOD));

            if (position.getY() >= this.target.getY() && nextPosition.getY() < this.target.getY() && velocity.getY() < 0) {
                // Calculate the exact fractional time it took to cross the line during this 0.005s tick
                double fraction = (this.target.getY() - position.getY()) / (nextPosition.getY() - position.getY());

                // Apply that fraction to X to get the exact crossing coordinate
                double exactX = position.getX() + fraction * (nextPosition.getX() - position.getX());
                Translation2d exactPosition = new Translation2d(exactX, this.target.getY());

                // Apply that fraction to the velocity
                double exactVx = velocity.getX() + fraction * (nextVelocity.getX() - velocity.getX());
                double exactVy = velocity.getY() + fraction * (nextVelocity.getY() - velocity.getY());
                Translation2d exactVelocity = new Translation2d(exactVx, exactVy);

                // Add the perfect sample and STOP simulating
                samples.add(new Sample(exactPosition, exactVelocity));
                break;
            }

            position = nextPosition;
            velocity = nextVelocity;
            samples.add(new Sample(position, velocity));
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
