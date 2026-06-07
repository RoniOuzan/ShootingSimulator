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

    private static final double ANGLE_DT_DIVIDER = 50;

    private static final double MISS_TARGET_COST = 100;
    private static final double SCALE_ROBUSTNESS = 200;
    private static final double SCALE_VELOCITY = 0.2;
    private static final double SCALE_TIME = 1.0;
    private static final double SCALE_ANGLE = 0.04;

    private static final boolean[] SHOT_PHASES = {true, false};

    private final TrajectorySolver builder;

    private final List<RobustnessPoint> robustnessSweep = new ArrayList<>();
    private final List<Translation2d> costSweep = new ArrayList<>();
    private List<Trajectory> trajectories = null;
    private Trajectory bestTrajectory = null;

    public TrajectoryCenterChooser(ShooterState state, TargetConfig target, PhysicalValues physicalValues, CostWeights costWeights, List<Obstacle> obstacles, CenterResolution resolution) {
        super(target, physicalValues, costWeights, obstacles, resolution);
        this.builder = new TrajectorySolver(state, target, physicalValues, obstacles, resolution);
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
        double angle = trajectory.getInitialShootingVelocity().getAngle().getDegrees();
        double velocity = trajectory.getInitialShootingVelocity().getNorm();
        boolean isFlat = trajectory.isFlat();

        TrajectorySolver farBuilder = this.builder.moveTarget(this.target.radius());
        TrajectorySolver closeBuilder = this.builder.moveTarget(-this.target.radius());

        double farVelocity = farBuilder.findTrajectoryForAngle(angle, isFlat).getInitialShootingVelocity().getNorm();
        double closeVelocity = closeBuilder.findTrajectoryForAngle(angle, isFlat).getInitialShootingVelocity().getNorm();

        double farAngle = farBuilder.findTrajectoryForVelocity(velocity, isFlat).getInitialShootingVelocity().getAngle().getDegrees();
        double closeAngle = closeBuilder.findTrajectoryForVelocity(velocity, isFlat).getInitialShootingVelocity().getAngle().getDegrees();

        // Calculate the slope (dV/dAngle) of the sweet spot band
        double deltaV = farVelocity - closeVelocity;
        double deltaA = farAngle - closeAngle;

        // The negative sign ensures the correct tilt direction based on trajectory phase (flat vs lob)
        double slope = (deltaA != 0) ? -(deltaV / deltaA) : 0;

        // Convert the slope into degrees for your JS dashboard and isWithinTolerance method
        double ellipseAngleDegrees = Math.toDegrees(Math.atan(slope));

        // Pass your 4 original limits + the new tilt angle
        trajectory.setTolerance(new Tolerance(
                Math.abs(farVelocity - velocity),
                Math.abs(closeVelocity - velocity),
                Math.abs(closeAngle - angle),
                Math.abs(farAngle - angle),
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
            for (boolean isFlat : SHOT_PHASES) {
                if (!canReachTarget(this.physicalValues.maxVel, angle, isFlat)) {
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

    private boolean canReachTarget(double velocity, double angle, boolean isFlat) {
        Trajectory trajectory = this.builder.simulateTrajectory(velocity, Rotation2d.fromDegrees(angle), false, isFlat);
        return trajectory.isReachedTargetHeight();
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