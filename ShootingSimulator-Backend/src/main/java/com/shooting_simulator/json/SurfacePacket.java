package com.shooting_simulator.json;

import com.shooting_simulator.SimulatorServer;
import com.shooting_simulator.simulation.*;
import com.shooting_simulator.util.math.geometry.Translation2d;
import org.java_websocket.WebSocket;

import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

public class SurfacePacket implements DataPacket {

    public double initialY;

    public double targetY;
    public String targetAxis;

    public double minHitAngle;
    public double maxHitAngle;

    public SweepBounds sweepBounds;
    public PhysicalValues physicalValues;
    public CostWeights costConfig;

    @Override
    public void handle(WebSocket conn, SimulatorServer server) {
        System.out.println("Simulating Surface...");

        Translation2d initialPos = new Translation2d(0, this.initialY);

        double distanceStep = this.sweepBounds.distStep();
        double radialVelocityStep = this.sweepBounds.radialVelStep();

        // Generate axes
        List<Double> distances = IntStream.range(0, (int) ((sweepBounds.maxDist() - sweepBounds.minDist()) / distanceStep) + 1)
                .mapToDouble(i -> sweepBounds.minDist() + (i * distanceStep))
                .map(x -> Math.round(x * 100.0) / 100.0)
                .boxed().toList();

        List<Double> radialVels = IntStream.range(0, (int) ((sweepBounds.maxRadialVel() - sweepBounds.minRadialVel()) / radialVelocityStep) + 1)
                .mapToDouble(i -> sweepBounds.minRadialVel() + (i * radialVelocityStep))
                .map(rv -> Math.round(rv * 100.0) / 100.0)
                .boxed().toList();

        int numRadialVels = radialVels.size();
        int numDistances = distances.size();

        // FIX 1: Change dimensions to [numDistances][numRadialVels]
        // to match frontend expectation: angleMatrix[distance_idx][vel_idx]
        Double[][] angleData = new Double[numDistances][numRadialVels];
        Double[][] velocityData = new Double[numDistances][numRadialVels];

        TargetAxis axis = TargetAxis.valueOf(this.targetAxis);

        int totalSteps = numDistances * numRadialVels;
        AtomicInteger currentStep = new AtomicInteger(0);
        AtomicInteger lastReportedProgress = new AtomicInteger(-1);
        AtomicInteger successCount = new AtomicInteger(0);

        long startTimeMs = System.currentTimeMillis();

        // Execute simulation in parallel
        IntStream.range(0, totalSteps).parallel().forEach(step -> {
            // FIX 2: Swap the index calculation to make Distance the "outer" dimension
            int dIdx = step / numRadialVels; // Row: Distance
            int rIdx = step % numRadialVels; // Column: Radial Velocity

            double x = distances.get(dIdx);
            double radialVelocity = radialVels.get(rIdx);
            Translation2d targetPos = new Translation2d(x, this.targetY);

            // FIX 3: Pass indices in the correct order [dIdx][rIdx]
            calculatePoint(initialPos, radialVelocity, targetPos, axis, angleData, velocityData, dIdx, rIdx, successCount);

            // ... Progress tracking (no changes needed) ...
            int completed = currentStep.incrementAndGet();
            int progress = (int) (((double) completed / totalSteps) * 100);

            if (progress > lastReportedProgress.get()) {
                synchronized (lastReportedProgress) {
                    if (progress > lastReportedProgress.get()) {
                        lastReportedProgress.set(progress);
                        long elapsedTimeMs = System.currentTimeMillis() - startTimeMs;
                        long estimatedTotalTimeMs = (long) (((double) elapsedTimeMs / completed) * totalSteps);
                        long eta = Math.max(0, estimatedTotalTimeMs - elapsedTimeMs);
                        server.sendPacket(conn, "progress", new ProgressPayload(progress, eta));
                    }
                }
            }
        });

        System.out.println("Simulation Complete. Success rate: " + successCount.get() + "/" + totalSteps);

        // Convert arrays to List<List<Double>> for payload
        List<List<Double>> angleMatrix = Arrays.stream(angleData).map(Arrays::asList).collect(Collectors.toList());
        List<List<Double>> velocityMatrix = Arrays.stream(velocityData).map(Arrays::asList).collect(Collectors.toList());

        SurfacePayload payload = new SurfacePayload(distances, radialVels, angleMatrix, velocityMatrix);
        server.sendPacket(conn, "surfaceResults", payload);
    }

    private void calculatePoint(Translation2d initialPos, double radialVelocity, Translation2d targetPos,
                                TargetAxis axis, Double[][] angleData, Double[][] velocityData,
                                int dIdx, int rIdx, AtomicInteger successCount) {
        TrajectoryChooser chooser = new TrajectoryChooser(
                this.physicalValues,
                initialPos,
                radialVelocity,
                targetPos,
                axis,
                this.minHitAngle,
                this.maxHitAngle,
                this.costConfig
        );

        Trajectory best = chooser.getBestTrajectory();
        if (best != null) {
            // FIX 4: Use swapped indices dIdx -> rIdx
            angleData[dIdx][rIdx] = Math.round(best.getInitialShootingVelocity().getAngle().getDegrees() * 1000.0) / 1000.0;
            velocityData[dIdx][rIdx] = Math.round(best.getInitialShootingVelocity().getNorm() * 1000.0) / 1000.0;
            successCount.incrementAndGet();
        }
    }

    public record SurfacePayload(
            List<Double> distances, List<Double> radialVels,
            List<List<Double>> angleMatrix, List<List<Double>> velocityMatrix
    ) {}

    public record SweepBounds(double minDist, double maxDist, double distStep, double minRadialVel, double maxRadialVel, double radialVelStep) {}

    public record ProgressPayload(int progress, long eta) {}
}