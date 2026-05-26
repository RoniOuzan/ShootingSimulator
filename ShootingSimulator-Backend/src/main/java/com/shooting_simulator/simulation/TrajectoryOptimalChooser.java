package com.shooting_simulator.simulation;

import com.shooting_simulator.simulation.obstacles.Obstacle;
import com.shooting_simulator.util.math.geometry.Translation2d;
import lombok.Getter;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Getter
public class TrajectoryOptimalChooser {

    private static final double EXIT_VELOCITY_DT = 0.000_01;
    private static final double ANGLE_DT = 0.000_01;

    private static final double ANGLE_DT_DIVIDER = 100;

    private static final double MISS_TARGET_COST = 100;
    private static final double SCALE_ROBUSTNESS = 200;
    private static final double SCALE_VELOCITY = 0.1;
    private static final double SCALE_TIME = 1.0;
    private static final double SCALE_ANGLE = 0.04;

    private static final boolean[] SHOT_PHASES = {true, false};

    private final PhysicalValues physicalValues;
    private final CostWeights costWeights;

    private final TrajectoryBuilder builder;
    private final TrajectoryBuilder closeBuilder;
    private final TrajectoryBuilder farBuilder;
    private final Translation2d target;
    private final double targetRadius;
    private final TargetAxis targetAxis;
    private final List<Obstacle> obstacles;

    private final List<RobustnessPoint> robustnessSweep;
    private final List<Translation2d> costSweep;
    private Trajectory bestTrajectory;

    public TrajectoryOptimalChooser(PhysicalValues physicalValues, Translation2d initialPosition, double radialVelocity, double targetY, double targetRadius, TargetAxis targetAxis, double minHitAngle, double maxHitAngle, CostWeights costWeights, List<Obstacle> obstacles) {
        this.physicalValues = physicalValues;
        this.costWeights = costWeights;

        this.target = new Translation2d(0, targetY);
        this.targetRadius = targetRadius;
        this.builder = new TrajectoryBuilder(initialPosition, radialVelocity, this.target, targetAxis, minHitAngle, maxHitAngle, physicalValues, obstacles);
        this.closeBuilder = new TrajectoryBuilder(initialPosition, radialVelocity, this.target.minus(new Translation2d(targetRadius, 0)), targetAxis, minHitAngle, maxHitAngle, physicalValues, obstacles);
        this.farBuilder = new TrajectoryBuilder(initialPosition, radialVelocity, this.target.plus(new Translation2d(targetRadius, 0)), targetAxis, minHitAngle, maxHitAngle, physicalValues, obstacles);
        this.targetAxis = targetAxis;
        this.obstacles = obstacles;

        this.robustnessSweep = new ArrayList<>();
        this.costSweep = new ArrayList<>();
        this.bestTrajectory = null;
    }

    public List<Translation2d> getCostSweep() {
        this.costSweep.sort(Comparator.comparing(Translation2d::getX));
        return this.costSweep;
    }

    public Trajectory getBestTrajectory() {
        if (this.bestTrajectory == null) {
            this.bestTrajectory = findBestTrajectory();
        }
        return this.bestTrajectory;
    }

    public Trajectory findBestTrajectory() {
        Trajectory bestFlat = findBestTrajectoryForPhase(true);
        Trajectory bestLob = findBestTrajectoryForPhase(false);

        if (bestFlat == null && bestLob == null) return null;
        if (bestFlat == null) return bestLob;
        if (bestLob == null) return bestFlat;

        return getCostAtAngle(bestFlat.getInitialShootingVelocity().getAngle().getDegrees(), true) < getCostAtAngle(bestLob.getInitialShootingVelocity().getAngle().getDegrees(), false)
                ? bestFlat : bestLob;
    }

    private Trajectory findBestTrajectoryForPhase(boolean isFlat) {
        double minAngle = calculateMinAngle();
        double maxAngle = calculateMaxAngle();

        double[] hitWindow = findHitWindow(minAngle, maxAngle, isFlat);

        if (hitWindow == null) {
            return null;
        }

        double bestAngle = goldenSectionSearch(hitWindow[0], hitWindow[1], isFlat);

        Trajectory trajectory = this.builder.findTrajectoryForAngle(bestAngle, isFlat);
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
            Trajectory t1 = this.closeBuilder.findTrajectoryForAngle(angle, isFlat);
            Trajectory t2 = this.farBuilder.findTrajectoryForAngle(angle, isFlat);

            if (t1 != null && t1.isHitTarget() && t2 != null && t2.isHitTarget()) {
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
        Trajectory closeTrajectory = this.closeBuilder.findTrajectoryForAngle(angle, isFlat);
        Trajectory farTrajectory = this.farBuilder.findTrajectoryForAngle(angle, isFlat);

        double cost;
        if (closeTrajectory == null || !closeTrajectory.isHitTarget() || farTrajectory == null || !farTrajectory.isHitTarget()) {
            cost = MISS_TARGET_COST;
        } else {
            cost = -(farTrajectory.getInitialShootingVelocity().getNorm() - closeTrajectory.getInitialShootingVelocity().getNorm());
        }

        this.costSweep.add(new Translation2d(angle, cost));
        return cost;
    }

    /**
     * Calculates the true real-world cost of a trajectory based on multi-objective weights.
     * Lower cost is better.
     */
//    public double calculateTrajectoryCost(Trajectory trajectory) {
//        double robustPenalty = Math.hypot(calculateMaxErrorForExitVelocity(trajectory), calculateMaxErrorForAngle(trajectory));
//
//        // Effort (Normalized: 10 m/s -> 1.0 baseline penalty)
//        double initialVelPenalty = trajectory.getInitialShootingVelocity().getNorm() * SCALE_VELOCITY;
//
//        // Impact Dynamics (Normalized)
//        double impactVelPenalty = trajectory.getHitSample().getVelocity().getNorm() * SCALE_VELOCITY;
//        double timeOfFlightPenalty = trajectory.getHitSample().getTime() * SCALE_TIME;
//
//        // Entry Angle (Normalized: 20 degrees off -> 1.0 baseline penalty)
//        Rotation2d impactAngle = trajectory.getHitSample().getVelocity().getAngle();
//        double rawAngleError = Math.abs(impactAngle.getDegrees() - this.costWeights.targetImpactAngle());
//        double entryAnglePenalty = rawAngleError * SCALE_ANGLE;
//
//        // Apply UI weights and sum
//        return (robustPenalty * this.costWeights.robustnessWeight()) +
//                (initialVelPenalty * this.costWeights.initialVelocityWeight()) +
//                (impactVelPenalty * this.costWeights.impactVelocityWeight()) +
//                (timeOfFlightPenalty * this.costWeights.timeOfFlightWeight()) +
//                (entryAnglePenalty * this.costWeights.entryAngleWeight());
//    }

    protected List<Trajectory> calculateTrajectories(TrajectoryBuilder builder) {
        List<Trajectory> trajectories = new ArrayList<>();
        for (double angle = this.physicalValues.minAngle; angle < this.physicalValues.maxAngle; angle++) {
            for (boolean isFlat : SHOT_PHASES) {
                Trajectory trajectory  = builder.findTrajectoryForAngle(angle, isFlat);

                if (trajectory.isHitTarget()) {
                    trajectories.add(trajectory);
                }
            }
        }
        return trajectories;
    }

    public List<Trajectory> calculateCloseTrajectories() {
        return calculateTrajectories(this.closeBuilder);
    }

    public List<Trajectory> calculateFarTrajectories() {
        return calculateTrajectories(this.farBuilder);
    }

    private double calculateMinAngle() {
        return this.physicalValues.minAngle;
    }

    private double calculateMaxAngle() {
        return this.physicalValues.maxAngle;
    }

    public record RobustnessPoint(double angle, double vReq, Double velError, Double angleError, Double rssError, Double rssDerivative) implements Comparable<RobustnessPoint> {
        @Override
        public int compareTo(RobustnessPoint o) {
            return Double.compare(this.angle, o.angle);
        }
    }
}