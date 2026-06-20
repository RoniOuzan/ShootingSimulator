package com.shooting_simulator.json;

import com.shooting_simulator.SimulatorServer;
import com.shooting_simulator.simulation.*;
import com.shooting_simulator.simulation.obstacles.Obstacle;
import com.shooting_simulator.simulation.records.*;
import com.shooting_simulator.util.math.geometry.Translation2d;
import org.java_websocket.WebSocket;

import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

public class SurfacePacket implements DataPacket {

    public double initialY;

    public TargetConfig target;

    public String simulationType;

    public SweepBounds sweepBounds;
    public PhysicalValues physicalValues;
    public CostWeights cost;
    public List<Obstacle> obstacles;

    public String resolutionMode;

    @Override
    public void handle(WebSocket conn, SimulatorServer server) {
        System.out.println("Simulating Surface...");

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

        Double[][] angleData = new Double[numDistances][numRadialVels];
        Double[][] velocityData = new Double[numDistances][numRadialVels];
        Double[][] flightTimeData = new Double[numDistances][numRadialVels];

        Double[][] angTolPosData = new Double[numDistances][numRadialVels];
        Double[][] angTolNegData = new Double[numDistances][numRadialVels];
        Double[][] velTolPosData = new Double[numDistances][numRadialVels];
        Double[][] velTolNegData = new Double[numDistances][numRadialVels];
        Double[][] ellipseAngleData = new Double[numDistances][numRadialVels];

        TargetAxis axis = target.axis();
        int totalSteps = numDistances * numRadialVels;
        AtomicInteger currentStep = new AtomicInteger(0);
        AtomicInteger lastReportedProgress = new AtomicInteger(-1);
        AtomicInteger successCount = new AtomicInteger(0);
        long startTimeMs = System.currentTimeMillis();

        IntStream.range(0, totalSteps).parallel().forEach(step -> {
            int dIdx = step / numRadialVels;
            int rIdx = step % numRadialVels;

            double x = distances.get(dIdx);
            double radialVelocity = radialVels.get(rIdx);
            Translation2d initialPos = new Translation2d(-x, this.initialY);

            calculatePoint(initialPos, radialVelocity,
                    angleData, velocityData, flightTimeData,
                    angTolPosData, angTolNegData, velTolPosData, velTolNegData, ellipseAngleData,
                    dIdx, rIdx, successCount);

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
        List<List<Double>> flightTimeMatrix = Arrays.stream(flightTimeData).map(Arrays::asList).collect(Collectors.toList());
        List<List<Double>> angTolPosMatrix = Arrays.stream(angTolPosData).map(Arrays::asList).collect(Collectors.toList());
        List<List<Double>> angTolNegMatrix = Arrays.stream(angTolNegData).map(Arrays::asList).collect(Collectors.toList());
        List<List<Double>> velTolPosMatrix = Arrays.stream(velTolPosData).map(Arrays::asList).collect(Collectors.toList());
        List<List<Double>> velTolNegMatrix = Arrays.stream(velTolNegData).map(Arrays::asList).collect(Collectors.toList());
        List<List<Double>> ellipseAngleMatrix = Arrays.stream(ellipseAngleData).map(Arrays::asList).collect(Collectors.toList());

        SurfacePayload payload = new SurfacePayload(
                distances, radialVels,
                angleMatrix, velocityMatrix, flightTimeMatrix,
                angTolPosMatrix, angTolNegMatrix,
                velTolPosMatrix, velTolNegMatrix,
                ellipseAngleMatrix
        );
        server.sendPacket(conn, "surfaceResults", payload);
    }

    private void calculatePoint(Translation2d initialPos, double radialVelocity,
                                Double[][] angleData, Double[][] velocityData, Double[][] flightTimeData,
                                Double[][] angTolPosData, Double[][] angTolNegData,
                                Double[][] velTolPosData, Double[][] velTolNegData, Double[][] ellipseAngleData,
                                int dIdx, int rIdx, AtomicInteger successCount) {
        Chooser chooser = SimulationType.valueOf(this.simulationType).create(
                new ShooterState(initialPos, radialVelocity),
                this.target,
                this.physicalValues,
                this.cost,
                this.obstacles,
                this.resolutionMode
        );

        Trajectory best = chooser.getBestTrajectory();
        if (best != null) {
            angleData[dIdx][rIdx] = Math.round(best.getInitialShootingVelocity().getAngle().getDegrees() * 1000.0) / 1000.0;
            velocityData[dIdx][rIdx] = Math.round(best.getInitialShootingVelocity().getNorm() * 1000.0) / 1000.0;
            flightTimeData[dIdx][rIdx] = Math.round(best.getHitSample().getTime() * 1000.0) / 1000.0;

            Tolerance tol = best.getTolerance();
            if (tol != null) {
                velTolPosData[dIdx][rIdx] = Math.round(tol.getVelocityPositive() * 1000.0) / 1000.0;
                velTolNegData[dIdx][rIdx] = Math.round(tol.getVelocityNegative() * 1000.0) / 1000.0;
                angTolPosData[dIdx][rIdx] = Math.round(tol.getAnglePositive() * 1000.0) / 1000.0;
                angTolNegData[dIdx][rIdx] = Math.round(tol.getAngleNegative() * 1000.0) / 1000.0;
                ellipseAngleData[dIdx][rIdx] = Math.round(tol.getEllipseAngle() * 1000.0) / 1000.0;
            }

            successCount.incrementAndGet();
        }
    }

    public record SurfacePayload(
            List<Double> distances, List<Double> radialVels,
            List<List<Double>> angleMatrix, List<List<Double>> velocityMatrix, List<List<Double>> flightTimeMatrix,
            List<List<Double>> toleranceAnglePositiveMatrix, List<List<Double>> toleranceAngleNegativeMatrix,
            List<List<Double>> toleranceVelPositiveMatrix, List<List<Double>> toleranceVelNegativeMatrix,
            List<List<Double>> toleranceEllipseAngleMatrix
    ) {}

    public record SweepBounds(double minDist, double maxDist, double distStep, double minRadialVel, double maxRadialVel, double radialVelStep) {}

    public record ProgressPayload(int progress, long eta) {}
}