package com.shooting_simulator.simulation;

import java.util.*;

import com.shooting_simulator.simulation.obstacles.Obstacle;
import com.shooting_simulator.util.math.MathUtil;
import com.shooting_simulator.util.math.geometry.Rotation2d;
import com.shooting_simulator.util.math.geometry.Translation2d;

import lombok.Getter;

@Getter
public class TrajectoryChooser {

    private static final double EXIT_VELOCITY_DT = 0.000_01;
    private static final double ANGLE_DT = 0.000_01;

    private static final double ANGLE_DT_DIVIDER = 100;

    private static final double MISS_TARGET_COST = 1000000;
    private static final double SCALE_ROBUSTNESS = 500.0;
    private static final double SCALE_VELOCITY = 0.1;
    private static final double SCALE_TIME = 1.0;
    private static final double SCALE_ANGLE = 0.04;

    private static final boolean[] SHOT_PHASES = {true, false};

    private final PhysicalValues physicalValues;
    private final CostWeights costWeights;

    private final TrajectoryBuilder builder;
    private final Translation2d target;
    private final TargetAxis targetAxis;
    private final List<Obstacle> obstacles;

    private final List<RobustnessPoint> robustnessSweep;
    private final List<Translation2d> costSweep;
    private List<Trajectory> trajectories;
    private Trajectory bestTrajectory;

    public TrajectoryChooser(PhysicalValues physicalValues, Translation2d initialPosition, double radialVelocity, double targetY, TargetAxis targetAxis, double minHitAngle, double maxHitAngle, CostWeights costWeights, List<Obstacle> obstacles) {
        this.physicalValues = physicalValues;
        this.costWeights = costWeights;

        this.target = new Translation2d(0, targetY);
        this.builder = new TrajectoryBuilder(initialPosition, radialVelocity, this.target, targetAxis, minHitAngle, maxHitAngle, physicalValues, obstacles);
        this.targetAxis = targetAxis;
        this.obstacles = obstacles;

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

        return calculateTrajectoryCost(bestFlat) < calculateTrajectoryCost(bestLob) ? bestFlat : bestLob;
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
        double sweepStep = 1;
        Double firstHit = null;
        Double lastHit = null;

        for (double angle = minAngle; angle <= maxAngle; angle += sweepStep) {
            Trajectory t = binarySearchBestVelocityForAngle(angle, isFlat);

            if (t != null && t.isHitTarget()) {
                if (firstHit == null) firstHit = angle;
                lastHit = angle;
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

        double bestAngle = (a + b) / 2.0;
        double bestCost = Double.MAX_VALUE;

        while (Math.abs(b - a) > ANGLE_DT) {
            double cost1 = getCostAtAngle(x1, isFlat);
            double cost2 = getCostAtAngle(x2, isFlat);

            if (cost1 < bestCost) {
                bestCost = cost1;
                bestAngle = x1;
            }

            if (cost2 < bestCost) {
                bestCost = cost2;
                bestAngle = x2;
            }

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

        return bestAngle;
    }

    private double getCostAtAngle(double angle, boolean isFlat) {
        Trajectory trajectory = binarySearchBestVelocityForAngle(angle, isFlat);

        double cost;
        if (trajectory == null || !trajectory.isHitTarget()) {
            cost = MISS_TARGET_COST;
        } else {
            cost = calculateTrajectoryCost(trajectory);
        }

        this.costSweep.add(new Translation2d(angle, cost));
        return cost;
    }

    /**
     * Calculates the true real-world cost of a trajectory based on multi-objective weights.
     * Lower cost is better.
     */
    public double calculateTrajectoryCost(Trajectory trajectory) {
        double robustPenalty = Math.hypot(calculateMaxErrorForExitVelocity(trajectory), calculateMaxErrorForAngle(trajectory));

        // Effort (Normalized: 10 m/s -> 1.0 baseline penalty)
        double initialVelPenalty = trajectory.getInitialShootingVelocity().getNorm() * SCALE_VELOCITY;

        // Impact Dynamics (Normalized)
        double impactVelPenalty = trajectory.getHitSample().getVelocity().getNorm() * SCALE_VELOCITY;
        double timeOfFlightPenalty = trajectory.getHitSample().getTime() * SCALE_TIME;

        // Entry Angle (Normalized: 20 degrees off -> 1.0 baseline penalty)
        Rotation2d impactAngle = trajectory.getHitSample().getVelocity().getAngle();
        double rawAngleError = Math.abs(impactAngle.getDegrees() - this.costWeights.targetImpactAngle());
        double entryAnglePenalty = rawAngleError * SCALE_ANGLE;

        // Apply UI weights and sum
        return (robustPenalty * this.costWeights.robustnessWeight()) +
                (initialVelPenalty * this.costWeights.initialVelocityWeight()) +
                (impactVelPenalty * this.costWeights.impactVelocityWeight()) +
                (timeOfFlightPenalty * this.costWeights.timeOfFlightWeight()) +
                (entryAnglePenalty * this.costWeights.entryAngleWeight());
    }

    private double calculateMaxErrorForExitVelocity(Trajectory trajectory) {
        Translation2d velocity = trajectory.getInitialShootingVelocity();
        Trajectory before = this.builder.simulateTrajectory(velocity.getNorm() - this.physicalValues.estimatedVelocityError, velocity.getAngle(), false, trajectory.isFlat());
        Trajectory after = this.builder.simulateTrajectory(velocity.getNorm() + this.physicalValues.estimatedVelocityError, velocity.getAngle(), false, trajectory.isFlat());

        if (!after.isReachedTargetHeight() || !before.isReachedTargetHeight()) return MISS_TARGET_COST;
        return SCALE_ROBUSTNESS * (this.targetAxis.getErrorAxis(after.getHitSample().getPosition()) - this.targetAxis.getErrorAxis(before.getHitSample().getPosition()));
    }

    private double calculateMaxErrorForAngle(Trajectory trajectory) {
        Translation2d velocity = trajectory.getInitialShootingVelocity();
        Rotation2d estimatedAngleError = Rotation2d.fromDegrees(this.physicalValues.estimatedAngleError);
        Trajectory before = this.builder.simulateTrajectory(velocity.getNorm(), velocity.getAngle().minus(estimatedAngleError), false, trajectory.isFlat());
        Trajectory after = this.builder.simulateTrajectory(velocity.getNorm(), velocity.getAngle().plus(estimatedAngleError), false, trajectory.isFlat());

        if (!after.isReachedTargetHeight() || !before.isReachedTargetHeight()) return MISS_TARGET_COST;
        return SCALE_ROBUSTNESS * (this.targetAxis.getErrorAxis(after.getHitSample().getPosition()) - this.targetAxis.getErrorAxis(before.getHitSample().getPosition()));
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
        return performBinarySearch(angle, this.physicalValues.minVel, this.physicalValues.maxVel, isFlat);
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
        return this.builder.simulateTrajectory((max + min) / 2.0, Rotation2d.fromDegrees(angle), isFlat);
    }

    private double calculateMinAngle() {
        return this.physicalValues.minAngle;
    }

    private double calculateMaxAngle() {
        return this.physicalValues.maxAngle;
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