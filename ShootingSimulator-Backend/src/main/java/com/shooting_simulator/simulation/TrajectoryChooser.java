package com.shooting_simulator.simulation;

import com.shooting_simulator.Constants;
import com.shooting_simulator.util.math.geometry.Rotation2d;
import com.shooting_simulator.util.math.geometry.Translation2d;
import lombok.Getter;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Getter
public class TrajectoryChooser {

    private static final double EXIT_VELOCITY_DT = 0.0005;
    private static final double ANGLE_DT = 0.5;

    private final PhysicalValues physicalLimits;

    private final TrajectoryBuilder builder;
    private final Translation2d target;

    private final List<Trajectory> trajectories;
    private final Trajectory bestTrajectory;

    public TrajectoryChooser(PhysicalValues physicalLimits, Translation2d initialPosition, Translation2d target, Translation2d targetTolerance, double minHitAngle, double maxHitAngle) {
        this.physicalLimits = physicalLimits;

        this.builder = new TrajectoryBuilder(initialPosition, target, targetTolerance, minHitAngle, maxHitAngle);
        this.target = target;

        this.trajectories = this.calculateTrajectories();
        this.bestTrajectory = this.chooseBestTrajectory();
    }

    private Trajectory chooseBestTrajectory() {
        return this.trajectories.stream().min(Comparator.comparing(this::calculateTrajectoryCost)).orElse(null);
    }

    private double calculateTrajectoryCost(Trajectory trajectory) {
        return Math.hypot(calculateMaxErrorForExitVelocity(trajectory), calculateMaxErrorForAngle(trajectory));
    }

    private double calculateMaxErrorForExitVelocity(Trajectory trajectory) {
        Translation2d velocity = trajectory.getInitialSample().getVelocity();
        Trajectory before = this.builder.simulateTrajectory(velocity.getNorm() - this.physicalLimits.estimatedVelocityError, velocity.getAngle());
        Trajectory after = this.builder.simulateTrajectory(velocity.getNorm() + this.physicalLimits.estimatedVelocityError, velocity.getAngle());

        return Math.abs(after.getFinalSample().getPosition().getX() - before.getFinalSample().getPosition().getX());
    }

    private double calculateMaxErrorForAngle(Trajectory trajectory) {
        Translation2d velocity = trajectory.getInitialSample().getVelocity();
        Rotation2d estimatedAngleError = Rotation2d.fromDegrees(this.physicalLimits.estimatedAngleError);
        Trajectory before = this.builder.simulateTrajectory(velocity.getNorm(), velocity.getAngle().minus(estimatedAngleError));
        Trajectory after = this.builder.simulateTrajectory(velocity.getNorm(), velocity.getAngle().plus(estimatedAngleError));

        return Math.abs(after.getFinalSample().getPosition().getX() - before.getFinalSample().getPosition().getX());
    }

    private List<Trajectory> calculateTrajectories() {
        List<Trajectory> trajectories = new ArrayList<>();

        double minAngle = Math.max(this.calculateMinAngle(), this.physicalLimits.minAngle);

        for (double angle = minAngle; angle <= this.physicalLimits.maxAngle; angle += ANGLE_DT) {
            Trajectory trajectory = binarySearchBestVelocityForAngle(angle);

            if (this.builder.isInsideTarget(trajectory.getFinalSample())) {
                trajectories.add(trajectory);
            }
        }

        return trajectories;
    }

    private Trajectory binarySearchBestVelocityForAngle(double angle) {
        double min = Math.max(this.calculateMinExitVelocity(angle), this.physicalLimits.minVel);
        double max = this.physicalLimits.maxVel;

        while (max - min > EXIT_VELOCITY_DT) {
            double mid = (max + min) / 2;

            Trajectory trajectory = this.builder.simulateTrajectory(mid, Rotation2d.fromDegrees(angle));

            Translation2d finalPos = trajectory.getFinalSample().getPosition();
            if (finalPos.getX() > this.target.getX()) {
                max = mid;
            } else {
                min = mid;
            }
        }

        return this.builder.simulateTrajectory((max + min) / 2, Rotation2d.fromDegrees(angle));
    }

    private double calculateMinAngle() {
        return this.target.minus(this.builder.getInitialPosition()).getAngle().getDegrees();
    }

    private double calculateMinExitVelocity(double angle) {
        // Min vy so the y will reach the target (v_final_y is 0 at the target)
        double vy = Math.sqrt(-2 * Constants.GRAVITY * (this.target.getY() - this.builder.getInitialPosition().getY()));

        return vy / Math.sin(Math.toRadians(angle));
    }

    public record RobustnessPoint(double angle, double vReq, Double velError, Double angleError, Double rssError) {}

    public List<RobustnessPoint> generateRobustnessSweep() {
        List<RobustnessPoint> sweepData = new ArrayList<>();
        double minAngle = Math.max(this.calculateMinAngle(), this.physicalLimits.minAngle);

        for (double angle = minAngle; angle <= this.physicalLimits.maxAngle; angle += ANGLE_DT) {
            // 1. Find required velocity for this angle (your existing binary search)
            Trajectory baseTrajectory = binarySearchBestVelocityForAngle(angle);

            if (!this.builder.isInsideTarget(baseTrajectory.getFinalSample())) {
                continue; // Skip if it can't reach the target
            }

            double vReq = baseTrajectory.getInitialSample().getVelocity().getNorm();

            // 2. Calculate the errors using your existing simulation logic (which handles drag later)
            double velErr = calculateMaxErrorForExitVelocity(baseTrajectory);
            double angErr = calculateMaxErrorForAngle(baseTrajectory);
            double rss = Math.hypot(velErr, angErr);

            sweepData.add(new RobustnessPoint(
                    angle,
                    Math.round(vReq * 100.0) / 100.0,
                    Math.round(velErr * 1000.0) / 1000.0,
                    Math.round(angErr * 1000.0) / 1000.0,
                    Math.round(rss * 1000.0) / 1000.0
            ));
        }
        return sweepData;
    }
}
