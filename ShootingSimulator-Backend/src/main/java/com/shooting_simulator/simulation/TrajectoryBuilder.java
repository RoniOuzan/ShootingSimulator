package com.shooting_simulator.simulation;

import com.shooting_simulator.Constants;
import com.shooting_simulator.util.math.MathUtil;
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

    public boolean isInsideTarget(Sample sample) {
        boolean withinXBounds = Math.abs(sample.getPosition().getX() - this.target.getX()) <= this.targetTolerance.getX();
        boolean withinYBounds = Math.abs(sample.getPosition().getY() - this.target.getY()) <= this.targetTolerance.getY();
        return withinXBounds && withinYBounds && isInHitAngleRange(sample.getVelocity().getAngle());
    }

    public Trajectory simulateTrajectory(double exitVelocity, Rotation2d angle) {
        List<Sample> samples = new ArrayList<>();

        Translation2d position = this.initialPosition;
        Translation2d velocity = new Translation2d(exitVelocity, angle);
        samples.add(new Sample(position, velocity));

        while (shouldCalculateTrajectory(position, velocity)) {
            Translation2d acceleration = new Translation2d(0, Constants.GRAVITY);

            // Calculate next position using exact kinematics (matches your quadratic solver)
            Translation2d nextPosition = position
                    .plus(velocity.times(PERIOD))
                    .plus(acceleration.times(0.5 * PERIOD * PERIOD));

            Translation2d nextVelocity = velocity.plus(acceleration.times(PERIOD));

            // Check for crossing
            if (position.getY() >= this.target.getY() && nextPosition.getY() < this.target.getY() && velocity.getY() < 0) {
                double deltaY = this.target.getY() - position.getY();

                // Solve: 0.5*a*t^2 + v*t - deltaY = 0
                double[] roots = MathUtil.quadraticSolver(0.5 * acceleration.getY(), velocity.getY(), -deltaY);

                double exactT = PERIOD; // fallback
                if (roots.length == 1) {
                    exactT = roots[0];
                } else if (roots.length == 2) {
                    // Pick the smallest positive root
                    double t1 = roots[0], t2 = roots[1];
                    if (t1 > 0 && t2 > 0) exactT = Math.min(t1, t2);
                    else exactT = Math.max(t1, t2);
                }

                // Recalculate exactly AT the crossing time
                Translation2d exactPosition = position
                        .plus(velocity.times(exactT))
                        .plus(acceleration.times(0.5 * exactT * exactT));

                Translation2d exactVelocity = velocity.plus(acceleration.times(exactT));

                // Add the perfect sample and STOP
                samples.add(new Sample(exactPosition, exactVelocity));
                break;
            }

            // Standard update if no crossing
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
