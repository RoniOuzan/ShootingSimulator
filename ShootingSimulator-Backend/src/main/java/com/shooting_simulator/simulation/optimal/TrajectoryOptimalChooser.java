package com.shooting_simulator.simulation.optimal;

import com.shooting_simulator.simulation.*;
import com.shooting_simulator.simulation.obstacles.Obstacle;
import com.shooting_simulator.util.math.geometry.Translation2d;
import lombok.Getter;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Getter
public class TrajectoryOptimalChooser {

    private static final double ANGLE_DT = 0.000_01;

    private static final double ANGLE_DT_DIVIDER = 50;

    public static final double MISS_TARGET_COST = 100;

    private static final boolean[] SHOT_PHASES = {true, false};

    private final PhysicalValues physicalValues;
    private final CostWeights costWeights;

    private final TrajectoryBuilder centerBuilder;
    private final TrajectoryBuilder closeBuilder;
    private final TrajectoryBuilder farBuilder;
    private final Translation2d target;
    private final double targetRadius;
    private final TargetAxis targetAxis;
    private final List<Obstacle> obstacles;

    private final List<TrajectoryChooser.RobustnessPoint> robustnessSweep;
    private final List<Translation2d> costSweep;

    public TrajectoryOptimalChooser(PhysicalValues physicalValues, Translation2d initialPosition, double radialVelocity, double targetY, double targetRadius, TargetAxis targetAxis, double minHitAngle, double maxHitAngle, CostWeights costWeights, List<Obstacle> obstacles) {
        this.physicalValues = physicalValues;
        this.costWeights = costWeights;

        this.target = new Translation2d(0, targetY);
        this.targetRadius = targetRadius;
        this.centerBuilder = new TrajectoryBuilder(initialPosition, radialVelocity, this.target, targetAxis, minHitAngle, maxHitAngle, physicalValues, obstacles);
        this.closeBuilder = new TrajectoryBuilder(initialPosition, radialVelocity, this.target.minus(new Translation2d(targetRadius, 0)), targetAxis, minHitAngle, maxHitAngle, physicalValues, obstacles);
        this.farBuilder = new TrajectoryBuilder(initialPosition, radialVelocity, this.target.plus(new Translation2d(targetRadius, 0)), targetAxis, minHitAngle, maxHitAngle, physicalValues, obstacles);
        this.targetAxis = targetAxis;
        this.obstacles = obstacles;

        this.robustnessSweep = new ArrayList<>();
        this.costSweep = new ArrayList<>();
    }

    public List<Translation2d> getCostSweep() {
        this.costSweep.sort(Comparator.comparing(Translation2d::getX));
        return this.costSweep;
    }

    public TrajectoryCouple findBestTrajectory() {
        TrajectoryCouple bestFlat = findBestTrajectoryForPhase(true);
        TrajectoryCouple bestLob = findBestTrajectoryForPhase(false);

        TrajectoryCouple trajectory;
        if (bestFlat == null && bestLob == null)
            return null;
        else if (bestFlat == null)
            trajectory = bestLob;
        else if (bestLob == null)
            trajectory = bestFlat;
        else
            trajectory = getCostAtAngle(bestFlat.getOptimalTrajectory().getInitialShootingVelocity().getAngle().getDegrees(), true) <
                    getCostAtAngle(bestLob.getOptimalTrajectory().getInitialShootingVelocity().getAngle().getDegrees(), false)
                    ? bestFlat : bestLob;

        trajectory.calculateTolerance();
        return trajectory;
    }

    private TrajectoryCouple findBestTrajectoryForPhase(boolean isFlat) {
        double minAngle = calculateMinAngle();
        double maxAngle = calculateMaxAngle();

        double[] hitWindow = findHitWindow(minAngle, maxAngle, isFlat);

        if (hitWindow == null) {
            return null;
        }

        double bestAngle = goldenSectionSearch(hitWindow[0], hitWindow[1], isFlat);

        Trajectory farTrajectory = this.farBuilder.findTrajectoryForAngle(bestAngle, isFlat);
        Trajectory closeTrajectory = this.closeBuilder.findTrajectoryForAngle(bestAngle, isFlat);
        if (farTrajectory != null && farTrajectory.isHitTarget() && closeTrajectory != null && closeTrajectory.isHitTarget()) {
            return new TrajectoryCouple(closeTrajectory, farTrajectory, this.centerBuilder, this.closeBuilder, this.farBuilder, this.physicalValues);
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

        if (closeTrajectory == null || !closeTrajectory.isHitTarget() || farTrajectory == null || !farTrajectory.isHitTarget()) {
            return MISS_TARGET_COST;
        }

        // Pass the extra builders and physical limits so the couple can score itself
        TrajectoryCouple couple = new TrajectoryCouple(
                closeTrajectory,
                farTrajectory,
                this.centerBuilder,
                this.closeBuilder,
                this.farBuilder,
                this.physicalValues
        );

        double cost = couple.getCost(this.costWeights);

        this.costSweep.add(new Translation2d(angle, cost));
        return cost;
    }

    public List<TrajectoryCouple> calculateTrajectories() {
        double prevCost = Double.NaN;
        double prevAngle = Double.NaN;

        double angleDT = (this.physicalValues.maxAngle - this.physicalValues.minAngle) / ANGLE_DT_DIVIDER;
        List<TrajectoryCouple> trajectories = new ArrayList<>();
        for (double angle = this.physicalValues.minAngle; angle <= this.physicalValues.maxAngle; angle += angleDT) {
            for (boolean isFlat : SHOT_PHASES) {
                Trajectory closeTrajectory = this.closeBuilder.findTrajectoryForAngle(angle, isFlat);
                Trajectory farTrajectory = this.farBuilder.findTrajectoryForAngle(angle, isFlat);

                if (closeTrajectory.isHitTarget() && farTrajectory.isHitTarget()) {
                    TrajectoryCouple couple = new TrajectoryCouple(closeTrajectory, farTrajectory, this.centerBuilder, this.closeBuilder, this.farBuilder, this.physicalValues);
                    trajectories.add(couple);

                    double vReq = couple.getOptimalTrajectory().getInitialShootingVelocity().getNorm();
                    double velErr = couple.getVelocityRobustnessCost();
                    double angleErr = couple.getAngleRobustnessCost();
                    double cost = couple.getCost(this.costWeights);

                    Double costDerivative = null;
                    if (!Double.isNaN(prevCost)) {
                        costDerivative = (cost - prevCost) / (angle - prevAngle);
                    }

                    this.robustnessSweep.add(new TrajectoryChooser.RobustnessPoint(
                            angle,
                            Math.round(vReq * 1000.0) / 1000.0,
                            Math.round(velErr * 1000_000.0) / 1000_000.0,
                            Math.round(angleErr * 1000_000.0) / 1000_000.0,
                            Math.round(cost * 1000_000.0) / 1000_000.0,
                            costDerivative == null ? null : Math.round(costDerivative * 1000_000.0) / 1000_000.0
                    ));

                    prevCost = cost;
                    prevAngle = angle;
                }
            }
        }
        return trajectories;
    }

    private double calculateMinAngle() {
        return this.physicalValues.minAngle;
    }

    private double calculateMaxAngle() {
        return this.physicalValues.maxAngle;
    }
}