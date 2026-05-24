package com.shooting_simulator.simulation;

import com.shooting_simulator.Constants;
import com.shooting_simulator.simulation.obstacles.Obstacle;
import com.shooting_simulator.util.math.MathUtil;
import com.shooting_simulator.util.math.geometry.Rotation2d;
import com.shooting_simulator.util.math.geometry.Translation2d;
import lombok.Getter;

import java.util.ArrayList;
import java.util.List;

@Getter
public class TrajectoryBuilder {
    private static final double EXIT_VELOCITY_DT = 0.000_01;
    public static final double PERIOD = 0.005;
    private static final double TOLERANCE = 0.001;

    private final Translation2d initialPosition;
    private final double radialVelocity;
    private final Translation2d target;
    private final TargetAxis targetAxis;

    private final double minHitAngle;
    private final double maxHitAngle;

    private final PhysicalValues physicalValues;
    private final List<Obstacle> obstacles;

    public TrajectoryBuilder(Translation2d initialPosition, double radialVelocity, Translation2d target, TargetAxis targetAxis, double minHitAngle, double maxHitAngle, PhysicalValues physicalValues, List<Obstacle> obstacles) {
        this.initialPosition = initialPosition;
        this.radialVelocity = radialVelocity;
        this.target = target;
        this.targetAxis = targetAxis;
        this.minHitAngle = minHitAngle;
        this.maxHitAngle = maxHitAngle;
        this.physicalValues = physicalValues;
        this.obstacles = obstacles == null ? new ArrayList<>() : obstacles;
    }

    public boolean isInsideTarget(Sample sample) {
        if (sample == null) return false;
        return isInsideTarget(sample.getPosition()) && isInHitAngleRange(sample.getVelocity().getAngle());
    }

    public boolean isInsideTarget(Translation2d position) {
        boolean withinXBounds = Math.abs(position.getX() - this.target.getX()) <= TOLERANCE;
        boolean withinYBounds = Math.abs(position.getY() - this.target.getY()) <= TOLERANCE;
        return withinXBounds && withinYBounds;
    }

    public Trajectory findTrajectoryForAngle(double angle, boolean isFlat) {
        double min = this.physicalValues.minVel;
        double max = this.physicalValues.maxVel;

        while (max - min > EXIT_VELOCITY_DT) {
            double mid = (min + max) / 2.0;
            Trajectory trajectory = this.simulateTrajectory(mid, Rotation2d.fromDegrees(angle), false, isFlat);

            if (!trajectory.isReachedTargetHeight()) {
                min = mid;
            } else {
                boolean overshot = this.targetAxis.getErrorAxis(trajectory.getHitSample().getPosition()) > this.targetAxis.getErrorAxis(this.target);

                if (isFlat) {
                    if (overshot) min = mid;
                    else max = mid;
                } else {
                    if (overshot) max = mid;
                    else min = mid;
                }
            }
        }
        return this.simulateTrajectory((max + min) / 2.0, Rotation2d.fromDegrees(angle), true, isFlat);
    }

    public Trajectory simulateTrajectory(double exitVelocity, Rotation2d angle, boolean checkObstacles, boolean isFlat) {
        return simulateTrajectory(exitVelocity, angle, true, checkObstacles, isFlat);
    }

    public Trajectory simulateTrajectory(double exitVelocity, Rotation2d angle, boolean checkLimits, boolean checkObstacles, boolean isFlat) {
        if (checkLimits && (angle.getDegrees() < this.physicalValues.minAngle - 1e-3 || angle.getDegrees() > this.physicalValues.maxAngle + 1e-3)) {
            throw new RuntimeException("Angle " + angle.getDegrees() + " is not possible to shoot in this shooter!");
        } else if (checkLimits && (exitVelocity < this.physicalValues.minVel - 1e-3 || exitVelocity > this.physicalValues.maxVel + 1e-3)) {
            throw new RuntimeException("Exit velocity " + exitVelocity + " is not possible to shoot in this shooter!");
        }

        List<Sample> samples = new ArrayList<>();
        Sample hitSample = null;

        final Translation2d initialShootingVelocity = new Translation2d(exitVelocity, angle);

        Translation2d position = this.initialPosition;
        Translation2d velocity = initialShootingVelocity.plus(new Translation2d(-this.radialVelocity, 0));
        samples.add(new Sample(position, velocity, new Translation2d(), 0));

        double time = 0;
        while (shouldCalculateTrajectory(position)) {
            Translation2d acceleration = calculateAcceleration(velocity);

            // Calculate next position using exact kinematics (matches your quadratic solver)
            Translation2d nextPosition = position
                    .plus(velocity.times(PERIOD))
                    .plus(acceleration.times(0.5 * PERIOD * PERIOD));

            Translation2d nextVelocity = velocity.plus(acceleration.times(PERIOD));

            // Check for crossing
            if (isPassedTarget(position, nextPosition, nextVelocity, isFlat)) {
                // Add the perfect sample and STOP
                hitSample = calculateLastSample(position, velocity, acceleration, time);
                samples.add(hitSample);

                // Only stops if vertical because in horizontal it can pass the y twice
                if (this.targetAxis == TargetAxis.VERTICAL)
                    break;
            }

            if (checkObstacles && isCollidingObstacle(position, nextPosition)) {
                break;
            }

            // Standard update if no crossing
            position = nextPosition;
            velocity = nextVelocity;
            time += PERIOD;
            samples.add(new Sample(position, velocity, acceleration, time));
        }

        return new Trajectory(samples, hitSample, this.isInsideTarget(hitSample), initialShootingVelocity, isFlat);
    }

    private boolean isPassedTarget(Translation2d prev, Translation2d next, Translation2d velocity, boolean isFlat) {
        if (this.targetAxis == TargetAxis.VERTICAL) {
            return prev.getX() <= this.target.getX() && next.getX() > this.target.getX();
        }

        if (isFlat) {
            return velocity.getY() > 0 && prev.getY() <= this.target.getY() && next.getY() > this.target.getY();
        } else {
            return velocity.getY() < 0 && prev.getY() >= this.target.getY() && next.getY() < this.target.getY();
        }
    }

    private boolean isCollidingObstacle(Translation2d prev, Translation2d next) {
        return this.obstacles.parallelStream().anyMatch(obstacle -> obstacle.isColliding(prev, next));
    }

    private boolean shouldCalculateTrajectory(Translation2d position) {
        // Keeps the simulation from running forever if it misses the target and falls
        return position.getY() >= 0;
    }

    private Sample calculateLastSample(Translation2d position, Translation2d velocity, Translation2d acceleration, double time) {
        double delta = this.targetAxis.getTargetAxis(this.target) - this.targetAxis.getTargetAxis(position);

        // Solve: 0.5*a*t^2 + v*t - delta = 0
        double[] roots = MathUtil.quadraticSolver(0.5 * this.targetAxis.getTargetAxis(acceleration), this.targetAxis.getTargetAxis(velocity), -delta);

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

        return new Sample(exactPosition, exactVelocity, acceleration, time + exactT);
    }

    private boolean isInHitAngleRange(Rotation2d angle) {
        return angle.getDegrees() >= this.minHitAngle && angle.getDegrees() <= this.maxHitAngle;
    }

    private Translation2d calculateAcceleration(Translation2d velocity) {
        Translation2d totalAcceleration = new Translation2d(0, Constants.GRAVITY); // gravity
        double vMag = velocity.getNorm();

        if (vMag > 0.001) { // Prevent division by zero
            double radius = this.physicalValues.diameter;
            double area = Math.PI * Math.pow(radius, 2);

            Translation2d dragAcceleration = calculateDrag(velocity, area);
            Translation2d magnusAcceleration = calculateMagnus(velocity, radius, area);

            totalAcceleration = totalAcceleration.plus(dragAcceleration).plus(magnusAcceleration);
        }

        return totalAcceleration;
    }

    private Translation2d calculateDrag(Translation2d velocity, double area) {
        double vMag = velocity.getNorm();

        // F_d = 0.5 * rho * v^2 * C_d * A
        double dragForce = 0.5 * Constants.AIR_DENSITY * (vMag * vMag) * this.physicalValues.dragCoeff * area;
        // a = F / m
        double dragAccMag = dragForce / this.physicalValues.mass;

        // Drag always opposes the velocity vector
        return velocity.div(vMag).times(-dragAccMag);
    }

    private Translation2d calculateMagnus(Translation2d velocity, double radius, double area) {
        double omega = this.getBallRPS(velocity.getNorm()) * (2 * Math.PI);

        // Calculate the Magnus scalar (v cancels out with the perpendicular vector normalizer)
        double magnusScalar = (0.5 * Constants.AIR_DENSITY * this.physicalValues.magnusCoeff * radius * omega * area) / this.physicalValues.mass;

        // The cross product of spin and velocity results in a perpendicular vector: (-Vy, Vx)
        return new Translation2d(-velocity.getY() * magnusScalar, velocity.getX() * magnusScalar);
    }

    private double getBallRPS(double velocity) {
        return this.physicalValues.spinRPSPerMS * velocity;
    }
}