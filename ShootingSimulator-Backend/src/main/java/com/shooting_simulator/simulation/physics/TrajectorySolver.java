package com.shooting_simulator.simulation.physics;

import com.shooting_simulator.simulation.records.PhysicalValues;
import com.shooting_simulator.simulation.records.Sample;
import com.shooting_simulator.simulation.records.TargetAxis;
import com.shooting_simulator.simulation.Trajectory;
import com.shooting_simulator.simulation.obstacles.Obstacle;
import com.shooting_simulator.simulation.records.ShooterState;
import com.shooting_simulator.simulation.records.TargetConfig;
import com.shooting_simulator.simulation.resolution.Resolution;
import com.shooting_simulator.util.math.MathUtil;
import com.shooting_simulator.util.math.geometry.Rotation2d;
import com.shooting_simulator.util.math.geometry.Translation2d;
import lombok.Getter;

import java.util.ArrayList;
import java.util.List;

@Getter
public class TrajectorySolver {

    public static final boolean[] SHOT_PHASES = {true, false};

    private final ShooterState state;
    private final TargetConfig target;

    private final Resolution resolution;

    private final PhysicalValues physicalValues;
    private final List<Obstacle> obstacles;

    private final AerodynamicsModel aerodynamicsModel;

    public TrajectorySolver(ShooterState state, TargetConfig target, PhysicalValues physicalValues, List<Obstacle> obstacles, Resolution resolution) {
        this.state = state;
        this.target = target;
        this.physicalValues = physicalValues;
        this.obstacles = obstacles == null ? new ArrayList<>() : obstacles;

        this.resolution = resolution;

        this.aerodynamicsModel = new AerodynamicsModel(physicalValues);
    }

    public boolean isInsideTarget(Sample sample) {
        if (sample == null) return false;
        return isInsideTarget(sample.getPosition()) && isInHitAngleRange(sample.getVelocity().getAngle());
    }

    public boolean isInsideTarget(Translation2d position) {
        boolean withinXBounds = Math.abs(position.getX() - this.target.center().getX()) <= this.resolution.getTargetTolerance();
        boolean withinYBounds = Math.abs(position.getY() - this.target.center().getY()) <= this.resolution.getTargetTolerance();
        return withinXBounds && withinYBounds;
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

        Translation2d position = this.state.initialPosition();
        Translation2d velocity = initialShootingVelocity.plus(new Translation2d(-this.state.radialVelocity(), 0));
        samples.add(new Sample(position, velocity, new Translation2d(), 0));

        double time = 0;
        while (shouldCalculateTrajectory(position)) {
            Translation2d acceleration = this.aerodynamicsModel.calculateAcceleration(velocity);

            // Calculate next position using exact kinematics (matches your quadratic solver)
            Translation2d nextPosition = position
                    .plus(velocity.times(this.resolution.getPeriod()))
                    .plus(acceleration.times(0.5 * this.resolution.getPeriod() * this.resolution.getPeriod()));

            Translation2d nextVelocity = velocity.plus(acceleration.times(this.resolution.getPeriod()));

            // Check for crossing
            if (isPassedTarget(position, nextPosition, nextVelocity, isFlat)) {
                // Add the perfect sample and STOP
                hitSample = calculateLastSample(position, velocity, acceleration, time);
                samples.add(hitSample);

                // Only stops if vertical because in horizontal it can pass the y twice
                if (this.target.axis() == TargetAxis.VERTICAL)
                    break;
            }

            if (checkObstacles && isCollidingObstacle(position, nextPosition)) {
                break;
            }

            // Standard update if no crossing
            position = nextPosition;
            velocity = nextVelocity;
            time += this.resolution.getPeriod();
            samples.add(new Sample(position, velocity, acceleration, time));
        }

        return new Trajectory(samples, hitSample, this.isInsideTarget(hitSample), initialShootingVelocity, isFlat);
    }

    private boolean isPassedTarget(Translation2d prev, Translation2d next, Translation2d velocity, boolean isFlat) {
        if (this.target.axis() == TargetAxis.VERTICAL) {
            return prev.getX() <= this.target.center().getX() && next.getX() > this.target.center().getX();
        }

        if (isFlat) {
            return velocity.getY() > 0 && prev.getY() <= this.target.center().getY() && next.getY() > this.target.center().getY();
        } else {
            return velocity.getY() < 0 && prev.getY() >= this.target.center().getY() && next.getY() < this.target.center().getY();
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
        double delta = this.target.axis().getTargetAxis(this.target.center()) - this.target.axis().getTargetAxis(position);

        // Solve: 0.5*a*t^2 + v*t - delta = 0
        double[] roots = MathUtil.quadraticSolver(0.5 * this.target.axis().getTargetAxis(acceleration), this.target.axis().getTargetAxis(velocity), -delta);

        double exactT = this.resolution.getPeriod(); // fallback
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
        return angle.getDegrees() >= this.target.minHitAngle() && angle.getDegrees() <= this.target.maxHitAngle();
    }

    public TrajectorySolver moveTarget(Translation2d offset) {
        return new TrajectorySolver(
                this.state,
                this.target.moveBy(offset),
                this.physicalValues,
                this.obstacles,
                this.resolution
        );
    }

    public TrajectorySolver moveTarget(double offset) {
        return new TrajectorySolver(
                this.state,
                this.target.moveBy(this.target.axis().create(offset)),
                this.physicalValues,
                this.obstacles,
                this.resolution
        );
    }

    public Trajectory findTrajectoryForAngle(double angle, boolean isFlat) {
        return findTrajectoryForAngle(angle, isFlat, true);
    }

    public Trajectory findTrajectoryForAngle(double angle, boolean isFlat, boolean checkLimits) {
        double min = this.physicalValues.minVel;
        double max = this.physicalValues.maxVel;

        while (max - min > this.resolution.getVelocity()) {
            double mid = (min + max) / 2.0;
            Trajectory trajectory = this.simulateTrajectory(mid, Rotation2d.fromDegrees(angle), checkLimits, true, isFlat);

            if (!trajectory.isReachedTargetHeight()) {
                min = mid;
            } else {
                boolean overshot = this.target.axis().getErrorAxis(trajectory.getHitSample().getPosition()) > this.target.axis().getErrorAxis(this.target.center());

                if (isFlat) {
                    if (overshot) min = mid;
                    else max = mid;
                } else {
                    if (overshot) max = mid;
                    else min = mid;
                }
            }
        }
        return this.simulateTrajectory((max + min) / 2.0, Rotation2d.fromDegrees(angle), checkLimits, true, isFlat);
    }

    public Trajectory findTrajectoryForVelocity(double velocity, boolean isFlat) {
        double min = this.physicalValues.minAngle;
        double max = this.physicalValues.maxAngle;

        while (max - min > this.resolution.getAngle()) {
            double mid = (min + max) / 2.0;
            Trajectory trajectory = this.simulateTrajectory(velocity, Rotation2d.fromDegrees(mid), false, isFlat);

            if (!trajectory.isReachedTargetHeight()) {
                min = mid;
            } else {
                boolean overshot = this.target.axis().getErrorAxis(trajectory.getHitSample().getPosition()) > this.target.axis().getErrorAxis(this.target.center());

                if (isFlat) {
                    // Flat arc (usually < 45 deg): Increasing angle INCREASES distance.
                    // If we overshot, we need less distance, so decrease the angle.
                    if (overshot) max = mid;
                    else min = mid;
                } else {
                    // High arc/lob (usually > 45 deg): Increasing angle DECREASES distance (shoots higher, lands shorter).
                    // If we overshot, we need less distance, so increase the angle.
                    if (overshot) min = mid;
                    else max = mid;
                }
            }
        }
        return this.simulateTrajectory(velocity, Rotation2d.fromDegrees((max + min) / 2.0), true, isFlat);
    }

    public List<Trajectory> getAllTrajectories(int samples) {
        List<Trajectory> trajectories = new ArrayList<>();

        double angleDT = (this.physicalValues.maxAngle - this.physicalValues.minAngle) / samples;
        for (double angle = this.physicalValues.minAngle; angle <= this.physicalValues.maxAngle; angle += angleDT) {
            for (boolean isFlat : SHOT_PHASES) {
                if (!canReachTarget(this.physicalValues.maxVel, angle, isFlat)) {
                    continue;
                }

                Trajectory trajectory = this.findTrajectoryForAngle(angle, isFlat);

                if (trajectory.isHitTarget()) {
                    trajectories.add(trajectory);
                }
            }
        }

        return trajectories;
    }

    public boolean canReachTarget(double velocity, double angle, boolean isFlat) {
        Trajectory trajectory = this.simulateTrajectory(velocity, Rotation2d.fromDegrees(angle), false, isFlat);
        return trajectory.isReachedTargetHeight();
    }
}