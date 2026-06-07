package com.shooting_simulator.simulation.optimal;

import com.shooting_simulator.simulation.*;
import com.shooting_simulator.simulation.obstacles.Obstacle;
import com.shooting_simulator.simulation.physics.TrajectorySolver;
import com.shooting_simulator.simulation.records.CostWeights;
import com.shooting_simulator.simulation.records.PhysicalValues;
import com.shooting_simulator.simulation.records.ShooterState;
import com.shooting_simulator.simulation.records.TargetConfig;
import com.shooting_simulator.simulation.resolution.OptimalResolution;
import com.shooting_simulator.util.math.geometry.Translation2d;
import lombok.Getter;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Getter
public class TrajectoryOptimalChooser extends Chooser {

    private static final double ANGLE_DT_DIVIDER = 200;

    public static final double MISS_TARGET_COST = 100;

    private static final boolean[] SHOT_PHASES = {true, false};

    private final TrajectorySolver centerBuilder;
    private final TrajectorySolver closeBuilder;
    private final TrajectorySolver farBuilder;

    private final List<TrajectoryCenterChooser.RobustnessPoint> robustnessSweep = new ArrayList<>();
    private final List<Translation2d> costSweep = new ArrayList<>();
    private final List<Translation2d> velocityGapSweep = new ArrayList<>();
    private final List<Translation2d> gapDerivativeSweep = new ArrayList<>();

    public TrajectoryOptimalChooser(ShooterState state, TargetConfig target, PhysicalValues physicalValues, CostWeights costWeights, List<Obstacle> obstacles, OptimalResolution resolution) {
        super(target, physicalValues, costWeights, obstacles, resolution);

        this.centerBuilder = new TrajectorySolver(state, target, physicalValues, obstacles, resolution);
        this.closeBuilder = this.centerBuilder.moveTarget(-target.radius());
        this.farBuilder = this.centerBuilder.moveTarget(target.radius());
    }

    @Override
    public Trajectory getBestTrajectory() {
        TrajectoryCouple trajectoryCouple = this.findBestTrajectory();
        if (trajectoryCouple == null) {
            return null;
        }
        return trajectoryCouple.getOptimalTrajectory();
    }

    public List<Translation2d> getCostSweep() {
        this.costSweep.sort(Comparator.comparing(Translation2d::getX));
        return this.costSweep;
    }

    public List<Translation2d> getVelocityGapSweep() {
        this.velocityGapSweep.sort(Comparator.comparing(Translation2d::getX));
        return this.velocityGapSweep;
    }

    public List<Translation2d> getGapDerivativeSweep() {
        this.gapDerivativeSweep.sort(Comparator.comparing(Translation2d::getX));
        return this.gapDerivativeSweep;
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
            return new TrajectoryCouple(closeTrajectory, farTrajectory, this.centerBuilder, this.closeBuilder, this.farBuilder, this.physicalValues, (OptimalResolution) this.resolution);
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

    @Override
    protected double getCostAtAngle(double angle, boolean isFlat) {
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
                this.physicalValues,
                (OptimalResolution) this.resolution
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
                    TrajectoryCouple couple = new TrajectoryCouple(closeTrajectory, farTrajectory, this.centerBuilder, this.closeBuilder, this.farBuilder, this.physicalValues, (OptimalResolution) this.resolution);
                    trajectories.add(couple);

                    double vReq = couple.getOptimalTrajectory().getInitialShootingVelocity().getNorm();
                    double velErr = couple.getVelocityRobustnessCost();
                    double angleErr = couple.getAngleRobustnessCost();
                    double cost = couple.getCost(this.costWeights);

                    Double costDerivative = null;
                    if (!Double.isNaN(prevCost)) {
                        costDerivative = (cost - prevCost) / (angle - prevAngle);
                    }

                    this.robustnessSweep.add(new TrajectoryCenterChooser.RobustnessPoint(
                            angle,
                            Math.round(vReq * 1000.0) / 1000.0,
                            Math.round(velErr * 1000_000.0) / 1000_000.0,
                            Math.round(angleErr * 1000_000.0) / 1000_000.0,
                            Math.round(cost * 1000_000.0) / 1000_000.0,
                            costDerivative == null ? null : Math.round(costDerivative * 1000_000.0) / 1000_000.0
                    ));

                    this.velocityGapSweep.add(new Translation2d(angle, couple.getVelocityGap()));
                    this.gapDerivativeSweep.add(new Translation2d(angle, couple.getGapDerivative()));

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