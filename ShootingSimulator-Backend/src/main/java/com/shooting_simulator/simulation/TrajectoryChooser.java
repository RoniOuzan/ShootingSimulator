package com.shooting_simulator.simulation;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

import com.shooting_simulator.util.math.MathUtil;
import com.shooting_simulator.util.math.geometry.Rotation2d;
import com.shooting_simulator.util.math.geometry.Translation2d;

import lombok.Getter;

@Getter
public class TrajectoryChooser {

    private static final double EXIT_VELOCITY_DT = 0.000_1;
    private static final double ANGLE_DT = 0.000_1;

    private static final double ANGLE_DT_DIVIDER = 100;

    private static final double MISS_TARGET_COST = 3;

    private static final boolean[] SHOT_PHASES = {true, false};

    private final PhysicalValues physicalValues;

    private final TrajectoryBuilder builder;
    private final Translation2d target;

    private final List<RobustnessPoint> robustnessSweep;
    private final List<Translation2d> costSweep;
    private List<Trajectory> trajectories;
    private Trajectory bestTrajectory;

    public TrajectoryChooser(PhysicalValues physicalValues, Translation2d initialPosition, double radialVelocity, Translation2d target, Translation2d targetTolerance, double minHitAngle, double maxHitAngle) {
        this.physicalValues = physicalValues;

        this.builder = new TrajectoryBuilder(initialPosition, radialVelocity, target, targetTolerance, minHitAngle, maxHitAngle, physicalValues);
        this.target = target;

        this.robustnessSweep = new ArrayList<>();
        this.costSweep = new ArrayList<>();
        this.trajectories = null;
        this.bestTrajectory = null;
    }

    public List<Translation2d> getCostSweep() {
        this.costSweep.sort(Comparator.comparing(Translation2d::getX));
        return this.costSweep;
    }

    public Trajectory getBestTrajectory() {
        if (this.bestTrajectory == null && this.trajectories == null) {
            this.bestTrajectory = findBestTrajectory();
        }
        return this.bestTrajectory;
    }

    public List<Trajectory> getTrajectories() {
        if (this.trajectories == null) {
            this.trajectories = calculateTrajectories();
            Collections.sort(this.robustnessSweep);
        }
        return this.trajectories;
    }

    public Trajectory findBestTrajectory() {
        Trajectory bestFlat = findBestTrajectoryForPhase(true);
        Trajectory bestLob = findBestTrajectoryForPhase(false);

        if (bestFlat == null && bestLob == null) return null;
        if (bestFlat == null) return bestLob;
        if (bestLob == null) return bestFlat;

        return calculateTrajectoryCost(bestFlat, true) < calculateTrajectoryCost(bestLob, false) ? bestFlat : bestLob;
    }

    private Trajectory findBestTrajectoryForPhase(boolean isFlat) {
        double minAngle = calculateMinAngle();
        double maxAngle = calculateMaxAngle();

        double[] hitWindow = findHitWindow(minAngle, maxAngle, isFlat);

        if (hitWindow == null) {
            return null;
        }

        double bestAngle = goldenSectionSearch(hitWindow[0], hitWindow[1], isFlat);

        Trajectory trajectory = binarySearchBestVelocityForAngle(bestAngle, isFlat);
        if (trajectory != null && trajectory.isHitTarget()) {
            return trajectory;
        }
        return null;
    }

    private double[] findHitWindow(double minAngle, double maxAngle, boolean isFlat) {
        double sweepStep = 1.0;
        Double firstHit = null;
        Double lastHit = null;

        for (double angle = minAngle; angle <= maxAngle; angle += sweepStep) {
            Trajectory t = binarySearchBestVelocityForAngle(angle, isFlat);

            if (t != null && t.isHitTarget()) {
                if (firstHit == null) firstHit = angle;
                lastHit = angle;
            } else if (firstHit != null) {
                break;
            }
        }

        if (firstHit == null) return null;

        return new double[]{
                Math.max(minAngle, firstHit - sweepStep),
                Math.min(maxAngle, lastHit + sweepStep)
        };
    }

    private double goldenSectionSearch(double min, double max, boolean isFlat) {
        double phi = (Math.sqrt(5) - 1) / 2;
        double a = min;
        double b = max;

        double x1 = b - phi * (b - a);
        double x2 = a + phi * (b - a);

        while (Math.abs(b - a) > ANGLE_DT) {
            double cost1 = getCostAtAngle(x1, isFlat);
            double cost2 = getCostAtAngle(x2, isFlat);

            if (cost1 < cost2) {
                b = x2;
                x2 = x1;
                x1 = b - phi * (b - a);
            } else {
                a = x1;
                x1 = x2;
                x2 = a + phi * (b - a);
            }
        }
        return (a + b) / 2.0;
    }

    private double getCostAtAngle(double angle, boolean isFlat) {
        Trajectory trajectory = binarySearchBestVelocityForAngle(angle, isFlat);

        double cost;
        if (trajectory == null || !trajectory.isHitTarget()) {
            cost = MISS_TARGET_COST;
        } else {
            cost = calculateTrajectoryCost(trajectory, isFlat);
        }

        this.costSweep.add(new Translation2d(angle, cost));
        return cost;
    }

    public double calculateTrajectoryCost(Trajectory trajectory, boolean isFlat) {
        return Math.hypot(calculateMaxErrorForExitVelocity(trajectory, isFlat), calculateMaxErrorForAngle(trajectory, isFlat));
    }

    private double calculateMaxErrorForExitVelocity(Trajectory trajectory, boolean isFlat) {
        Translation2d velocity = trajectory.getInitialShootingVelocity();
        Trajectory before = this.builder.simulateTrajectory(velocity.getNorm() - this.physicalValues.estimatedVelocityError, velocity.getAngle(), false, isFlat);
        Trajectory after = this.builder.simulateTrajectory(velocity.getNorm() + this.physicalValues.estimatedVelocityError, velocity.getAngle(), false, isFlat);

        if (!after.isReachedTargetHeight() || !before.isReachedTargetHeight()) return MISS_TARGET_COST;

        return after.getHitSample().getPosition().getX() - before.getHitSample().getPosition().getX();
    }

    private double calculateMaxErrorForAngle(Trajectory trajectory, boolean isFlat) {
        Translation2d velocity = trajectory.getInitialShootingVelocity();
        Rotation2d estimatedAngleError = Rotation2d.fromDegrees(this.physicalValues.estimatedAngleError);
        Trajectory before = this.builder.simulateTrajectory(velocity.getNorm(), velocity.getAngle().minus(estimatedAngleError), false, isFlat);
        Trajectory after = this.builder.simulateTrajectory(velocity.getNorm(), velocity.getAngle().plus(estimatedAngleError), false, isFlat);

        if (!after.isReachedTargetHeight() || !before.isReachedTargetHeight()) return MISS_TARGET_COST;

        return after.getHitSample().getPosition().getX() - before.getHitSample().getPosition().getX();
    }

    private List<Trajectory> calculateTrajectories() {
        double minAngle = this.calculateMinAngle();
        double maxAngle = this.calculateMaxAngle();

        List<Trajectory> trajectories = calculateTrajectoriesFromAngles(minAngle, maxAngle, (maxAngle - minAngle) / ANGLE_DT_DIVIDER);

        if (this.bestTrajectory == null) {
            return new ArrayList<>();
        }
        return trajectories;
    }

    private List<Trajectory> calculateTrajectoriesFromAngles(double minAngle, double maxAngle, double angleDT) {
        List<Trajectory> trajectories = new ArrayList<>();

        double prevCost = Double.NaN;
        double prevAngle = Double.NaN;

        double bestCost = Double.MAX_VALUE;
        this.bestTrajectory = null;

        for (double angle = minAngle; angle <= maxAngle; angle += angleDT) {
            for (boolean isFlat : SHOT_PHASES) {
                if (!canReachTarget(this.physicalValues.maxVel, angle, isFlat)) {
                    continue;
                }

                Trajectory trajectory = binarySearchBestVelocityForAngle(angle, isFlat);

                if (trajectory.isHitTarget()) {
                    trajectories.add(trajectory);

                    double vReq = trajectory.getInitialShootingVelocity().getNorm();
                    double velErr = Math.abs(calculateMaxErrorForExitVelocity(trajectory, isFlat));
                    double angErr = Math.abs(calculateMaxErrorForAngle(trajectory, isFlat));
                    double cost = calculateTrajectoryCost(trajectory, isFlat);

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

                    if (cost < bestCost) {
                        bestCost = cost;
                        this.bestTrajectory = trajectory;
                    }

                    prevCost = cost;
                    prevAngle = angle;
                }
            }
        }

        return trajectories;
    }

    private Trajectory binarySearchBestVelocityForAngle(double angle, boolean isFlat) {
        double minLimit = Math.max(this.calculateMinExitVelocity(angle), this.physicalValues.minVel);
        double maxLimit = this.physicalValues.maxVel;

        return performBinarySearch(angle, minLimit, maxLimit, isFlat);
    }

    private boolean canReachTarget(double velocity, double angle, boolean isFlat) {
        Trajectory trajectory = this.builder.simulateTrajectory(velocity, Rotation2d.fromDegrees(angle), isFlat);
        return trajectory.isReachedTargetHeight();
    }

    private Trajectory performBinarySearch(double angle, double min, double max, boolean isFlat) {
        while (max - min > EXIT_VELOCITY_DT) {
            double mid = (min + max) / 2.0;
            Trajectory trajectory = this.builder.simulateTrajectory(mid, Rotation2d.fromDegrees(angle), isFlat);

            if (!trajectory.isReachedTargetHeight()) {
                min = mid;
            } else {
                boolean overshotX = trajectory.getHitSample().getPosition().getX() > this.target.getX();

                if (isFlat) {
                    if (overshotX) min = mid;
                    else max = mid;
                } else {
                    if (overshotX) max = mid;
                    else min = mid;
                }
            }
        }
        return this.builder.simulateTrajectory((max + min) / 2.0, Rotation2d.fromDegrees(angle), isFlat);
    }

    private double calculateMinAngle() {
        return this.physicalValues.minAngle;
    }

    private double calculateMaxAngle() {
        return this.physicalValues.maxAngle;
    }

    private double calculateMinExitVelocity(double angle) {
        // double deltaY = this.target.getY() - this.builder.getInitialPosition().getY();
        // // Min vy so the y will reach the target (v_final_y is 0 at the target)
        // double vy = Math.sqrt(-2 * Constants.GRAVITY * deltaY);

        // double vx = vy / Math.tan(Math.toRadians(angle));

        // double vx_needed = vx - this.builder.getRadialVelocity();

        // return Math.hypot(vx_needed, vy);
        return this.physicalValues.minVel;
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
