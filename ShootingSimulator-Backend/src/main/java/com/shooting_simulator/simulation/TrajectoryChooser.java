package com.shooting_simulator.simulation;

import com.shooting_simulator.Constants;
import com.shooting_simulator.util.math.MathUtil;
import com.shooting_simulator.util.math.geometry.Rotation2d;
import com.shooting_simulator.util.math.geometry.Translation2d;
import lombok.Getter;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Getter
public class TrajectoryChooser {

    private static final double EXIT_VELOCITY_DT = 0.0005;
//    private static final double ANGLE_DT = 0.01;
    private static final double ANGLE_DT_DIVIDER = 20;
    private static final int ANGLE_RECURSION = 5;

    private final PhysicalValues physicalValues;

    private final TrajectoryBuilder builder;
    private final Translation2d target;

    private final Double maxAngle;

    private final List<Trajectory> trajectories;
    private final List<RobustnessPoint> robustnessSweep;

    private Trajectory bestTrajectory;

    public TrajectoryChooser(PhysicalValues physicalValues, Translation2d initialPosition, Translation2d target, Translation2d targetTolerance, double minHitAngle, double maxHitAngle, Double maxAngle) {
        this.physicalValues = physicalValues;

        this.builder = new TrajectoryBuilder(initialPosition, target, targetTolerance, minHitAngle, maxHitAngle, physicalValues);
        this.target = target;

        this.maxAngle = maxAngle;

        this.robustnessSweep = new ArrayList<>();
        this.trajectories = this.calculateTrajectories();

        Collections.sort(this.robustnessSweep);
    }

    public TrajectoryChooser(PhysicalValues physicalValues, Translation2d initialPosition, Translation2d target, Translation2d targetTolerance, double minHitAngle, double maxHitAngle) {
        this(physicalValues, initialPosition, target, targetTolerance, minHitAngle, maxHitAngle, null);
    }

    public double calculateTrajectoryCost(Trajectory trajectory) {
        return Math.hypot(calculateMaxErrorForExitVelocity(trajectory), calculateMaxErrorForAngle(trajectory));
    }

    private double calculateMaxErrorForExitVelocity(Trajectory trajectory) {
        Translation2d velocity = trajectory.getInitialSample().getVelocity();
        Trajectory before = this.builder.simulateTrajectory(velocity.getNorm() - this.physicalValues.estimatedVelocityError, velocity.getAngle());
        Trajectory after = this.builder.simulateTrajectory(velocity.getNorm() + this.physicalValues.estimatedVelocityError, velocity.getAngle());

        return after.getFinalSample().getPosition().getX() - before.getFinalSample().getPosition().getX();
    }

    private double calculateMaxErrorForAngle(Trajectory trajectory) {
        Translation2d velocity = trajectory.getInitialSample().getVelocity();
        Rotation2d estimatedAngleError = Rotation2d.fromDegrees(this.physicalValues.estimatedAngleError);
        Trajectory before = this.builder.simulateTrajectory(velocity.getNorm(), velocity.getAngle().minus(estimatedAngleError));
        Trajectory after = this.builder.simulateTrajectory(velocity.getNorm(), velocity.getAngle().plus(estimatedAngleError));

        return after.getFinalSample().getPosition().getX() - before.getFinalSample().getPosition().getX();
    }

    private List<Trajectory> calculateTrajectories() {
        double minAngle = this.calculateMinAngle();
        double maxAngle = this.calculateMaxAngle();

        return calculateTrajectories(0, minAngle, maxAngle, (maxAngle - minAngle) / ANGLE_DT_DIVIDER);
    }

    private List<Trajectory> calculateTrajectories(int times, double minAngle, double maxAngle, double angleDT) {
        List<Trajectory> trajectories = calculateTrajectoriesFromAngles(minAngle, maxAngle, angleDT);

        if (times == ANGLE_RECURSION) {
            return trajectories;
        }

        if (this.bestTrajectory == null) {
            return new ArrayList<>();
        }

        double angle = this.bestTrajectory.getInitialSample().getVelocity().getAngle().getDegrees();

        double cost = getCostDerivative(angle);
        double range = (1 / Math.pow(10, times));
        if (!Double.isNaN(cost) || cost < 0) {
            minAngle = angle;
            maxAngle = angle + range;
        } else {
            minAngle = angle - range;
            maxAngle = angle;
        }

        List<Trajectory> results = calculateTrajectories(
                times + 1,
                minAngle,
                maxAngle,
                range / ANGLE_DT_DIVIDER);
        results.addAll(trajectories);
        return results;
    }

    private List<Trajectory> calculateTrajectoriesFromAngles(double minAngle, double maxAngle, double angleDT) {
        List<Trajectory> trajectories = new ArrayList<>();

        double prevCost = Double.NaN;
        double prevAngle = Double.NaN;

        double bestCost = Double.MAX_VALUE;
        this.bestTrajectory = null;

        double lastBestVelocity = (this.physicalValues.minVel + this.physicalValues.maxVel) / 2.0;
        for (double angle = minAngle; angle <= maxAngle; angle += angleDT) {
            // If the strongest shot can't reach the target, skip this angle
            if (!canReachTarget(this.physicalValues.maxVel, angle)) {
                continue;
            }

            Trajectory trajectory = binarySearchBestVelocityForAngle(angle, lastBestVelocity);

            if (this.builder.isInsideTarget(trajectory.getFinalSample())) {
                trajectories.add(trajectory);

                double vReq = trajectory.getInitialSample().getVelocity().getNorm();

                // Calculate the errors using your existing simulation logic (which handles drag later)
                double velErr = Math.abs(calculateMaxErrorForExitVelocity(trajectory));
                double angErr = Math.abs(calculateMaxErrorForAngle(trajectory));
                double cost = calculateTrajectoryCost(trajectory);

                Double costDerivative = null;
                if (!Double.isNaN(prevCost)) {
                    costDerivative = (cost - prevCost) / (angle - prevAngle);
                }

                this.robustnessSweep.add(new RobustnessPoint(
                        angle,
                        Math.round(vReq * 1000.0) / 1000.0,
                        Math.round(velErr * 1000_000.0) / 1000_000.0,
                        Math.round(angErr * 1000_000.0) / 1000_000.0,
                        Math.round(cost * 1000_000.0) / 1000_000.0,
                        costDerivative == null ? null : Math.round(costDerivative * 1000_000.0) / 1000_000.0
                ));

                // Logic to maintain the best bounding trajectories
                if (cost < bestCost) {
                    bestCost = cost;
                    this.bestTrajectory = trajectory;
                }

                // Update the seed for the next iteration
                prevCost = cost;
                prevAngle = angle;
                lastBestVelocity = trajectory.getInitialSample().getVelocity().getNorm();
            }
        }

        return trajectories;
    }

    private Trajectory binarySearchBestVelocityForAngle(double angle, double seedVelocity) {
        double minLimit = Math.max(this.calculateMinExitVelocity(angle), this.physicalValues.minVel);
        double maxLimit = this.physicalValues.maxVel;

        // Neighborhood Search: Check a small window around the seed
        double window = 1.0;
        double localMin = Math.max(minLimit, seedVelocity - window);
        double localMax = Math.min(maxLimit, seedVelocity + window);

        // If the target is within this narrow window, perform a fast search
        if (canReachTarget(angle, localMin) != canReachTarget(angle, localMax)) {
            return performBinarySearch(angle, localMin, localMax);
        }

        // Otherwise, fall back to the full range search
        return performBinarySearch(angle, minLimit, maxLimit);
    }

    private boolean canReachTarget(double angle, double velocity) {
        Trajectory trajectory = this.builder.simulateTrajectory(velocity, Rotation2d.fromDegrees(angle));
        return trajectory.getFinalSample().getPosition().getX() > this.target.getX();
    }

    private Trajectory performBinarySearch(double angle, double min, double max) {
        while (max - min > EXIT_VELOCITY_DT) {
            double mid = (min + max) / 2.0;
            if (canReachTarget(angle, mid)) {
                max = mid;
            } else {
                min = mid;
            }
        }
        return this.builder.simulateTrajectory((max + min) / 2.0, Rotation2d.fromDegrees(angle));
    }

    private double calculateMinAngle() {
        double angleToTarget = this.target.minus(this.builder.getInitialPosition()).getAngle().getDegrees();
        return Math.max(angleToTarget, this.physicalValues.minAngle);
    }

    private double calculateMaxAngle() {
//        if (this.maxAngle != null) {
//            return Math.min(this.maxAngle, this.physicalValues.maxAngle);
//        }

        return this.physicalValues.maxAngle;
    }

    private double calculateMinExitVelocity(double angle) {
        // Min vy so the y will reach the target (v_final_y is 0 at the target)
        double vy = Math.sqrt(-2 * Constants.GRAVITY * (this.target.getY() - this.builder.getInitialPosition().getY()));

        return vy / Math.sin(Math.toRadians(angle));
    }

    private double getCostDerivative(double angle) {
        for (RobustnessPoint robustnessPoint : this.robustnessSweep) {
            if (robustnessPoint.rssDerivative != null && MathUtil.equals(robustnessPoint.angle, angle)) {
                return robustnessPoint.rssDerivative;
            }
        }
        return Double.NaN;
    }

    public record RobustnessPoint(double angle, double vReq, Double velError, Double angleError, Double rssError, Double rssDerivative) implements Comparable<RobustnessPoint> {
        @Override
        public int compareTo(RobustnessPoint o) {
            return Double.compare(this.angle, o.angle);
        }
    }
}
