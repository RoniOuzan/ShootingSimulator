package com.shooting_simulator.json;

import com.shooting_simulator.SimulatorServer;
import com.shooting_simulator.simulation.PhysicalValues;
import com.shooting_simulator.simulation.Trajectory;
import com.shooting_simulator.simulation.TrajectoryChooser;
import com.shooting_simulator.util.math.geometry.Translation2d;
import org.java_websocket.WebSocket;

import java.util.ArrayList;
import java.util.List;

public class SweepPacket implements DataPacket {
    public double initialY;
    public double targetY;

    public double tolX;
    public double tolY;

    public double minHitAngle;
    public double maxHitAngle;

    public PhysicalValues physicalValues;

    @Override
    public void handle(WebSocket conn, SimulatorServer server) {
        Translation2d initialPos = new Translation2d(0, this.initialY);

        Translation2d tolerance = new Translation2d(this.tolX, this.tolY);

        List<DistancePoint> sweepData = new ArrayList<>();

        double minDistance = 1.0;
        double maxDistance = 8.0;
        double distanceStep = 0.05;

        Double prevAngle = null;
        Double prevVel = null;
        for (double x = minDistance; x <= maxDistance; x += distanceStep) {
            Translation2d targetPos = new Translation2d(x, this.targetY);

            TrajectoryChooser chooser = new TrajectoryChooser(
                    this.physicalValues,
                    initialPos,
                    targetPos,
                    tolerance,
                    this.minHitAngle,
                    this.maxHitAngle,
                    prevAngle
            );

            Trajectory best = chooser.getBestTrajectory();

            if (best != null) {

                double vReq = best.getInitialSample().getVelocity().getNorm();
                double angle = best.getInitialSample().getVelocity().getAngle().getDegrees();
                double rssError = chooser.calculateTrajectoryCost(best);
                Double angleDerive = (prevAngle != null) ? (angle - prevAngle) / distanceStep : null;
                Double velDerive = (prevVel != null) ? (vReq - prevVel) / distanceStep : null;

                double a = Math.round(x * 100) / 100.0;
                if (a == 5.85 || a == 5.8) {
                    System.out.println(x + ": " + angle + " | " + vReq);
                }

                sweepData.add(new DistancePoint(
                        Math.round(x * 100.0) / 100.0,
                        Math.round(angle * 10.0) / 10.0,
                        Math.round(vReq * 100.0) / 100.0,
                        Math.round(rssError * 1000.0) / 1000.0,
                        angleDerive,
                        velDerive
                ));

                prevAngle = angle;
                prevVel = vReq;
            } else {
                // If the shot is impossible at this distance, return nulls.
                // Recharts will automatically break the line on the graph to show a "dead zone".
                sweepData.add(new DistancePoint(Math.round(x * 100.0) / 100.0, null, null, null, null, null));
            }
        }

        server.sendPacket(conn, "sweepResults", new SweepPayload(sweepData));
    }

    public record DistancePoint(
            double distanceX,
            Double optimalAngle,
            Double optimalVelocity,
            Double rssError,
            Double angleDerivative,
            Double velocityDerivative
    ) {}
    public record SweepPayload(List<DistancePoint> data) {}
}