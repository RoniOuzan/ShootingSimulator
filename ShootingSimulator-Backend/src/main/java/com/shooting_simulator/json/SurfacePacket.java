package com.shooting_simulator.json;

import com.shooting_simulator.SimulatorServer;
import com.shooting_simulator.simulation.PhysicalValues;
import com.shooting_simulator.simulation.Trajectory;
import com.shooting_simulator.simulation.TrajectoryChooser;
import com.shooting_simulator.util.math.geometry.Translation2d;
import org.java_websocket.WebSocket;

import java.util.ArrayList;
import java.util.List;

public class SurfacePacket implements DataPacket {

    public double initialY;
    public double targetY;

    public double tolX;
    public double tolY;

    public double minHitAngle;
    public double maxHitAngle;

    public SweepBounds sweepBounds;

    public PhysicalValues physicalValues;

    @Override
    public void handle(WebSocket conn, SimulatorServer server) {
        System.out.println("Simulating...");

        Translation2d initialPos = new Translation2d(0, this.initialY);
        Translation2d tolerance = new Translation2d(this.tolX, this.tolY);

        // Pull bounds dynamically from the frontend payload
        double distanceStep = this.sweepBounds.distStep; // Tweak this for resolution vs. performance
        double radialVelocityStep = this.sweepBounds.radialVelStep;

        List<Double> distances = new ArrayList<>();
        List<Double> radialVels = new ArrayList<>();

        // Pre-calculate the axes arrays
        for (double x = sweepBounds.minDist(); x <= sweepBounds.maxDist(); x += distanceStep) {
            distances.add(Math.round(x * 100.0) / 100.0);
        }
        for (double rv = sweepBounds.minRadialVel(); rv <= sweepBounds.maxRadialVel(); rv += radialVelocityStep) {
            radialVels.add(Math.round(rv * 100.0) / 100.0);
        }

        List<List<Double>> angleMatrix = new ArrayList<>();
        List<List<Double>> velocityMatrix = new ArrayList<>();

        // Build the 2D Matrices. Outer loop: Y (Radial Vel). Inner loop: X (Distance).
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
                        tolerance,
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
                    // Plotly uses nulls to create gaps/holes in the 3D surface for impossible shots
                    angleRow.add(null);
                    velocityRow.add(null);
                }
            }
            angleMatrix.add(angleRow);
            velocityMatrix.add(velocityRow);
        }

        // Send the re-formatted payload to the correct WebSocket listener
        SurfacePayload payload = new SurfacePayload(distances, radialVels, angleMatrix, velocityMatrix);
        server.sendPacket(conn, "surfaceResults", payload); // Note: changed from sweepResults to surfaceResults
    }

    // Updated Records to match the frontend expectations
    public record SurfacePayload(
            List<Double> distances,
            List<Double> radialVels,
            List<List<Double>> angleMatrix,
            List<List<Double>> velocityMatrix
    ) {}

    public record SweepBounds(double minDist, double maxDist, double distStep, double minRadialVel, double maxRadialVel, double radialVelStep) {}
}