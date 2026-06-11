package com.shooting_simulator.simulation;

import java.util.*;

import com.shooting_simulator.simulation.obstacles.Obstacle;
import com.shooting_simulator.simulation.physics.TrajectorySolver;
import com.shooting_simulator.simulation.records.CostWeights;
import com.shooting_simulator.simulation.records.PhysicalValues;
import com.shooting_simulator.simulation.records.ShooterState;
import com.shooting_simulator.simulation.records.TargetConfig;
import com.shooting_simulator.simulation.resolution.CenterResolution;
import com.shooting_simulator.util.math.geometry.Rotation2d;
import com.shooting_simulator.util.math.geometry.Translation2d;

import lombok.Getter;

@Getter
public class TrajectoryCenterChooser extends Chooser {

    private static final int ANGLE_DT_DIVIDER = 100;
    private static final int EDGES_ANGLE_DT_DIVIDER = 100;

    private static final double MISS_TARGET_COST = 100;
    private static final double SCALE_ROBUSTNESS = 200;
    private static final double SCALE_VELOCITY = 0.2;
    private static final double SCALE_TIME = 1.0;
    private static final double SCALE_ANGLE = 0.04;

    private final TrajectorySolver builder;
    private final TrajectorySolver closeBuilder;
    private final TrajectorySolver farBuilder;

    private final List<RobustnessPoint> robustnessSweep = new ArrayList<>();
    private final List<Translation2d> costSweep = new ArrayList<>();
    private List<Trajectory> trajectories = null;
    private Trajectory bestTrajectory = null;

    public TrajectoryCenterChooser(ShooterState state, TargetConfig target, PhysicalValues physicalValues, CostWeights costWeights, List<Obstacle> obstacles, CenterResolution resolution) {
        super(target, physicalValues, costWeights, obstacles, resolution);

        this.builder = new TrajectorySolver(state, target, physicalValues, obstacles, resolution);
        this.closeBuilder = this.builder.moveTarget(-target.radius());
        this.farBuilder = this.builder.moveTarget(target.radius());
    }

    public List<Translation2d> getCostSweep() {
        this.costSweep.sort(Comparator.comparing(Translation2d::getX));
        return this.costSweep;
    }

    @Override
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

        if (bestFlat == null && bestLob == null)
            return null;

        Trajectory trajectory;
        if (bestFlat == null)
            trajectory = bestLob;
        else if (bestLob == null)
            trajectory = bestFlat;
        else
            trajectory = calculateTrajectoryCost(bestFlat) < calculateTrajectoryCost(bestLob) ? bestFlat : bestLob;

        this.evaluateTolerance(trajectory);
        return trajectory;
    }

    private void evaluateTolerance(Trajectory trajectory) {
        double vNorm = trajectory.getInitialShootingVelocity().getNorm();
        Rotation2d rotCenter = trajectory.getInitialShootingVelocity().getAngle();
        boolean isFlat = trajectory.isFlat();

        // Use tiny nudges to measure physical sensitivity in BOTH directions
        double epsAngle = 0.1; // degrees
        double epsVel = 0.1; // m/s

        double posCenter = this.target.axis().getErrorAxis(trajectory.getHitSample().getPosition());

        // --- Measure Angle Sensitivity (+ and -) ---
        Trajectory tAnglePlus = this.builder.simulateTrajectory(vNorm, rotCenter.plus(Rotation2d.fromDegrees(epsAngle)), false, true, isFlat);
        double posAnglePlus = (tAnglePlus != null && tAnglePlus.isReachedTargetHeight())
                ? this.target.axis().getErrorAxis(tAnglePlus.getHitSample().getPosition())
                : posCenter;

        Trajectory tAngleMinus = this.builder.simulateTrajectory(vNorm, rotCenter.minus(Rotation2d.fromDegrees(epsAngle)), false, true, isFlat);
        double posAngleMinus = (tAngleMinus != null && tAngleMinus.isReachedTargetHeight())
                ? this.target.axis().getErrorAxis(tAngleMinus.getHitSample().getPosition())
                : posCenter;

        // --- Measure Velocity Sensitivity (+ and -) ---
        Trajectory tVelPlus = this.builder.simulateTrajectory(vNorm + epsVel, rotCenter, false, true, isFlat);
        double posVelPlus = (tVelPlus != null && tVelPlus.isReachedTargetHeight())
                ? this.target.axis().getErrorAxis(tVelPlus.getHitSample().getPosition())
                : posCenter;

        Trajectory tVelMinus = this.builder.simulateTrajectory(vNorm - epsVel, rotCenter, false, true, isFlat);
        double posVelMinus = (tVelMinus != null && tVelMinus.isReachedTargetHeight())
                ? this.target.axis().getErrorAxis(tVelMinus.getHitSample().getPosition())
                : posCenter;

        // Calculate signed derivatives for both sides (Forward and Backward Difference)
        double dPos_dAnglePlus = (posAnglePlus - posCenter) / epsAngle;
        double dPos_dAngleMinus = (posCenter - posAngleMinus) / epsAngle;

        double dPos_dVelPlus = (posVelPlus - posCenter) / epsVel;
        double dPos_dVelMinus = (posCenter - posVelMinus) / epsVel;

        // Calculate asymmetric tolerance bounds
        double angleTolerancePlus = (Math.abs(dPos_dAnglePlus) > 0.0001) ? (this.target.radius() / Math.abs(dPos_dAnglePlus)) : 0;
        double angleToleranceMinus = (Math.abs(dPos_dAngleMinus) > 0.0001) ? (this.target.radius() / Math.abs(dPos_dAngleMinus)) : 0;

        double velTolerancePlus = (Math.abs(dPos_dVelPlus) > 0.0001) ? (this.target.radius() / Math.abs(dPos_dVelPlus)) : 0;
        double velToleranceMinus = (Math.abs(dPos_dVelMinus) > 0.0001) ? (this.target.radius() / Math.abs(dPos_dVelMinus)) : 0;

        // Calculate exact Ellipse Tilt using Central Difference (Averages the deltas for a better tangent)
        double dPos_dAngleAvg = (posAnglePlus - posAngleMinus) / (2 * epsAngle);
        double dPos_dVelAvg = (posVelPlus - posVelMinus) / (2 * epsVel);

        double slope = (dPos_dVelAvg != 0) ? -(dPos_dAngleAvg / dPos_dVelAvg) : 0;
        double ellipseAngleDegrees = Math.toDegrees(Math.atan(slope));

        trajectory.setTolerance(new Tolerance(
                velTolerancePlus,
                velToleranceMinus,
                angleToleranceMinus,
                angleTolerancePlus,
                ellipseAngleDegrees
        ));
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
            Trajectory t = this.builder.findTrajectoryForAngle(angle, isFlat);

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

    @Override
    protected double getCostAtAngle(double angle, boolean isFlat) {
        Trajectory trajectory = this.builder.findTrajectoryForAngle(angle, isFlat);

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
        Trajectory before = this.builder.simulateTrajectory(velocity.getNorm() - this.physicalValues.estimatedVelocityError, velocity.getAngle(), false, true, trajectory.isFlat());
        Trajectory after = this.builder.simulateTrajectory(velocity.getNorm() + this.physicalValues.estimatedVelocityError, velocity.getAngle(), false, true, trajectory.isFlat());

        if (!after.isReachedTargetHeight() || !before.isReachedTargetHeight()) return MISS_TARGET_COST;
        return SCALE_ROBUSTNESS * (this.target.axis().getErrorAxis(after.getHitSample().getPosition()) - this.target.axis().getErrorAxis(before.getHitSample().getPosition()));
    }

    private double calculateMaxErrorForAngle(Trajectory trajectory) {
        Translation2d velocity = trajectory.getInitialShootingVelocity();
        Rotation2d estimatedAngleError = Rotation2d.fromDegrees(this.physicalValues.estimatedAngleError);
        Trajectory before = this.builder.simulateTrajectory(velocity.getNorm(), velocity.getAngle().minus(estimatedAngleError), false, true, trajectory.isFlat());
        Trajectory after = this.builder.simulateTrajectory(velocity.getNorm(), velocity.getAngle().plus(estimatedAngleError), false, true, trajectory.isFlat());

        if (!after.isReachedTargetHeight() || !before.isReachedTargetHeight()) return MISS_TARGET_COST;
        return SCALE_ROBUSTNESS * (this.target.axis().getErrorAxis(after.getHitSample().getPosition()) - this.target.axis().getErrorAxis(before.getHitSample().getPosition()));
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
            for (boolean isFlat : TrajectorySolver.SHOT_PHASES) {
                if (!this.builder.canReachTarget(this.physicalValues.maxVel, angle, isFlat)) {
                    continue;
                }

                Trajectory trajectory = this.builder.findTrajectoryForAngle(angle, isFlat);

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

    public List<Trajectory> getCloseTrajectories() {
        return this.closeBuilder.getAllTrajectories(EDGES_ANGLE_DT_DIVIDER);
    }

    public List<Trajectory> getFarTrajectories() {
        return this.farBuilder.getAllTrajectories(EDGES_ANGLE_DT_DIVIDER);
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