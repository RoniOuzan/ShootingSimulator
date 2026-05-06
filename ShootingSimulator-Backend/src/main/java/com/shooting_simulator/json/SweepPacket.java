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

public class SweepPacket implements DataPacket {
    public double initialY;
    public double radialVelocity;

    public double targetY;
    public String targetAxis;

    public double minHitAngle;
    public double maxHitAngle;

    public SweepBounds sweepBounds;
    public PhysicalValues physicalValues;

    @Override
    public void handle(WebSocket conn, SimulatorServer server) {
        Translation2d initialPos = new Translation2d(0, this.initialY);

        List<DistancePoint> sweepData = new ArrayList<>();

        double minDistance = (sweepBounds != null) ? sweepBounds.minDist() : 1.0;
        double maxDistance = (sweepBounds != null) ? sweepBounds.maxDist() : 8.0;
        double distanceStep = (sweepBounds != null) ? sweepBounds.distStep() : 0.05;

        int totalSteps = (int) Math.ceil((maxDistance - minDistance) / distanceStep) + 1;
        int currentStep = 0;
        int lastReportedProgress = -1;

        // Track time for ETA calculation
        long startTimeMs = System.currentTimeMillis();

        Double prevAngle = null;
        Double prevVel = null;

        for (double x = minDistance; x <= maxDistance; x += distanceStep) {
            Translation2d targetPos = new Translation2d(x, this.targetY);

            TrajectoryChooser chooser = new TrajectoryChooser(
                    this.physicalValues,
                    initialPos,
                    this.radialVelocity,
                    targetPos,
                    TargetAxis.valueOf(this.targetAxis),
                    this.minHitAngle,
                    this.maxHitAngle
            );

            Trajectory best = chooser.getBestTrajectory();

            if (best != null) {
                double vReq = best.getInitialShootingVelocity().getNorm();
                double angle = best.getInitialShootingVelocity().getAngle().getDegrees();

                double rssError = chooser.calculateTrajectoryCost(best);

                Double angleDerive = (prevAngle != null) ? (angle - prevAngle) / distanceStep : null;
                Double velDerive = (prevVel != null) ? (vReq - prevVel) / distanceStep : null;

                sweepData.add(new DistancePoint(
                        Math.round(x * 1000.0) / 1000.0,
                        Math.round(angle * 1000.0) / 1000.0,
                        Math.round(vReq * 1000.0) / 1000.0,
                        Math.round(rssError * 1000.0) / 1000.0,
                        angleDerive == null ? null : Math.round(angleDerive * 1000.0) / 1000.0,
                        velDerive == null ? null : Math.round(velDerive * 1000.0) / 1000.0
                ));

                prevAngle = angle;
                prevVel = vReq;
            } else {
                sweepData.add(new DistancePoint(Math.round(x * 1000.0) / 1000.0, null, null, null, null, null));
            }

            // --- Progress & ETA Tracking ---
            currentStep++;
            int progress = (int) (((double) currentStep / totalSteps) * 100);

            if (progress > lastReportedProgress) {
                long elapsedTimeMs = System.currentTimeMillis() - startTimeMs;
                long estimatedTotalTimeMs = (long) (((double) elapsedTimeMs / currentStep) * totalSteps);
                long eta = estimatedTotalTimeMs - elapsedTimeMs;

                server.sendPacket(conn, "progress", new ProgressPayload(progress, eta));
                lastReportedProgress = progress;
            }
        }

        server.sendPacket(conn, "sweepResults", new SweepPayload(sweepData));
    }

    public record DistancePoint(
            double distanceX, Double optimalAngle, Double optimalVelocity,
            Double rssError, Double angleDerivative, Double velocityDerivative
    ) {}

    public record SweepPayload(List<DistancePoint> data) {}
    public record SweepBounds(double minDist, double maxDist, double distStep) {}

    // Updated Record
    public record ProgressPayload(int progress, long eta) {}
}