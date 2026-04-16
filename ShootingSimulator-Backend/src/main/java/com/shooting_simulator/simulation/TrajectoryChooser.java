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

    private static final double MAX_EXIT_VELOCITY = 12;
    private static final double MIN_EXIT_VELOCITY = 6;
    private static final double EXIT_VELOCITY_DT = 0.01;

    private static final double MIN_ANGLE = 50;
    private static final double MAX_ANGLE = 80;
    private static final double ANGLE_DT = 0.5;

    private static final double EXIT_VELOCITY_ESTIMATED_ERROR = 0.2;
    private static final Rotation2d ANGLE_ESTIMATED_ERROR = Rotation2d.fromDegrees(0.3);

    private final TrajectoryBuilder builder;
    private final Translation2d target;

    private final List<Trajectory> trajectories;
    private final Trajectory bestTrajectory;

    public TrajectoryChooser(Translation2d initialPosition, Translation2d target, Translation2d targetTolerance, double minHitAngle, double maxHitAngle) {
        this.builder = new TrajectoryBuilder(initialPosition, target, targetTolerance, minHitAngle, maxHitAngle);
        this.target = target;

        this.trajectories = this.calculateTrajectories();
        this.bestTrajectory = this.chooseBestTrajectory();
    }

    private Trajectory chooseBestTrajectory() {
        return this.trajectories.stream().min(Comparator.comparing(this::calculateTrajectoryCost)).orElse(null);
    }

    private double calculateTrajectoryCost(Trajectory trajectory) {
        return calculateMaxErrorForExitVelocity(trajectory) + calculateMaxErrorForAngle(trajectory);
    }

    private double calculateMaxErrorForExitVelocity(Trajectory trajectory) {
        Translation2d velocity = trajectory.getInitialSample().getVelocity();
        Trajectory before = this.builder.simulateTrajectory(velocity.getNorm() - EXIT_VELOCITY_ESTIMATED_ERROR, velocity.getAngle());
        Trajectory after = this.builder.simulateTrajectory(velocity.getNorm() + EXIT_VELOCITY_ESTIMATED_ERROR, velocity.getAngle());

        return Math.abs(after.getErrorFromTarget(this.target) - before.getErrorFromTarget(this.target));
    }

    private double calculateMaxErrorForAngle(Trajectory trajectory) {
        Translation2d velocity = trajectory.getInitialSample().getVelocity();
        Trajectory before = this.builder.simulateTrajectory(velocity.getNorm(), velocity.getAngle().minus(ANGLE_ESTIMATED_ERROR));
        Trajectory after = this.builder.simulateTrajectory(velocity.getNorm(), velocity.getAngle().plus(ANGLE_ESTIMATED_ERROR));

        return Math.abs(after.getErrorFromTarget(this.target) - before.getErrorFromTarget(this.target));
    }

    private List<Trajectory> calculateTrajectories() {
        List<Trajectory> trajectories = new ArrayList<>();

        double minAngle = Math.max(this.calculateMinAngle(), MIN_ANGLE);

        for (double angle = minAngle; angle <= MAX_ANGLE; angle += ANGLE_DT) {
            Trajectory trajectory = binarySearchBestVelocityForAngle(angle);

            if (this.builder.hasHitTarget(trajectory)) {
                trajectories.add(trajectory);
            }
        }

        return trajectories;
    }

    private Trajectory binarySearchBestVelocityForAngle(double angle) {
        double min = Math.max(this.calculateMinExitVelocity(angle), MIN_EXIT_VELOCITY);
        double max = MAX_EXIT_VELOCITY;

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
}
