package com.shooting_simulator.json;

import com.shooting_simulator.SimulatorServer;
import com.shooting_simulator.simulation.PhysicalValues;
import com.shooting_simulator.simulation.TargetAxis;
import com.shooting_simulator.simulation.Trajectory;
import com.shooting_simulator.simulation.TrajectoryChooser;
import com.shooting_simulator.util.math.geometry.Translation2d;
import org.java_websocket.WebSocket;

import java.util.ArrayList;
import java.util.List;

public class SurfacePacket implements DataPacket {

    public double initialY;

    public double targetY;
    public String targetAxis;

    public double minHitAngle;
    public double maxHitAngle;

    public SweepBounds sweepBounds;
    public PhysicalValues physicalValues;

    @Override
    public void handle(WebSocket conn, SimulatorServer server) {
        System.out.println("Simulating Surface...");

        Translation2d initialPos = new Translation2d(0, this.initialY);

        double distanceStep = this.sweepBounds.distStep();
        double radialVelocityStep = this.sweepBounds.radialVelStep();

        List<Double> distances = new ArrayList<>();
        List<Double> radialVels = new ArrayList<>();

        for (double x = sweepBounds.minDist(); x <= sweepBounds.maxDist(); x += distanceStep) {
            distances.add(Math.round(x * 100.0) / 100.0);
        }
        for (double rv = sweepBounds.minRadialVel(); rv <= sweepBounds.maxRadialVel(); rv += radialVelocityStep) {
            radialVels.add(Math.round(rv * 100.0) / 100.0);
        }

        List<List<Double>> angleMatrix = new ArrayList<>();
        List<List<Double>> velocityMatrix = new ArrayList<>();

        int totalSteps = distances.size() * radialVels.size();
        int currentStep = 0;
        int lastReportedProgress = -1;

        // Track time for ETA calculation
        long startTimeMs = System.currentTimeMillis();

        for (double radialVelocity : radialVels) {
            List<Double> angleRow = new ArrayList<>();
            List<Double> velocityRow = new ArrayList<>();

            for (double x : distances) {
                Translation2d targetPos = new Translation2d(x, this.targetY);

                TrajectoryChooser chooser = new TrajectoryChooser(
                        this.physicalValues,
                        initialPos,
                        radialVelocity,
                        targetPos,
                        TargetAxis.valueOf(this.targetAxis),
                        this.minHitAngle,
                        this.maxHitAngle
                );

                Trajectory best = chooser.getBestTrajectory();

                if (best != null) {
                    double vReq = best.getInitialShootingVelocity().getNorm();
                    double angle = best.getInitialShootingVelocity().getAngle().getDegrees();

                    angleRow.add(Math.round(angle * 1000.0) / 1000.0);
                    velocityRow.add(Math.round(vReq * 1000.0) / 1000.0);
                } else {
                    angleRow.add(null);
                    velocityRow.add(null);
                }

                // --- Progress & ETA Tracking ---
                currentStep++;
                int progress = (int) (((double) currentStep / totalSteps) * 100);

                if (progress > lastReportedProgress) {
                    long elapsedTimeMs = System.currentTimeMillis() - startTimeMs;
                    long estimatedTotalTimeMs = (long) (((double) elapsedTimeMs / currentStep) * totalSteps);
                    long eta = Math.max(0, estimatedTotalTimeMs - elapsedTimeMs); // Ensure no negative values

                    server.sendPacket(conn, "progress", new ProgressPayload(progress, eta));
                    lastReportedProgress = progress;
                }
            }
            angleMatrix.add(angleRow);
            velocityMatrix.add(velocityRow);
        }

        SurfacePayload payload = new SurfacePayload(distances, radialVels, angleMatrix, velocityMatrix);
        server.sendPacket(conn, "surfaceResults", payload);
    }

    public record SurfacePayload(
            List<Double> distances, List<Double> radialVels,
            List<List<Double>> angleMatrix, List<List<Double>> velocityMatrix
    ) {}

    public record SweepBounds(double minDist, double maxDist, double distStep, double minRadialVel, double maxRadialVel, double radialVelStep) {}

    public record ProgressPayload(int progress, long eta) {}
}