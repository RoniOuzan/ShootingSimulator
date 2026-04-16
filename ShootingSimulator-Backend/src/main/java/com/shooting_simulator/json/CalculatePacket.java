package com.shooting_simulator.json;

import com.shooting_simulator.SimulatorServer;
import com.shooting_simulator.json.DataPacket;
import com.shooting_simulator.simulation.TrajectoryChooser;
import com.shooting_simulator.simulation.Trajectory;
import com.shooting_simulator.util.math.geometry.Rotation2d;
import com.shooting_simulator.util.math.geometry.Translation2d;
import org.java_websocket.WebSocket;

import java.util.List;

public class CalculatePacket implements DataPacket {

    // Fields match the JSON coming from React
    public double targetX;
    public double targetY;
    public double tolX;
    public double tolY;
    
    // Limits
    public double minAngle;
    public double maxAngle;
    public double minVel;
    public double maxVel;

    public double minHitAngle;
    public double maxHitAngle;

    @Override
    public void handle(WebSocket conn, SimulatorServer server) {
        // Setup target and tolerances based on React's request
        Translation2d initialPos = new Translation2d(0, 0);
        Translation2d target = new Translation2d(targetX, targetY);
        Translation2d targetTolerance = new Translation2d(tolX, tolY);

        // Run the math
        TrajectoryChooser chooser = new TrajectoryChooser(initialPos, target, targetTolerance, minHitAngle, maxHitAngle);
        List<Trajectory> validTrajectories = chooser.getTrajectories();
        Trajectory bestTrajectory = chooser.getBestTrajectory();

        // Create a payload object to hold the results
        ResultsPayload payload = new ResultsPayload(validTrajectories, bestTrajectory);

        // Send the results back to the React client that requested it!
        server.sendPacket(conn, "results", payload);
    }
    
    // Inner class representing the JSON structure React expects back
    private static class ResultsPayload {
        public List<Trajectory> trajectories;
        public Trajectory bestTrajectory;
        public TrajectoryInfo bestInfo;

        public ResultsPayload(List<Trajectory> valid, Trajectory best) {
            this.trajectories = valid;
            this.bestTrajectory = best;
            
            if (best != null && !best.getSamples().isEmpty()) {
                Translation2d initialVel = best.getSamples().get(0).getVelocity();
                this.bestInfo = new TrajectoryInfo(
                    initialVel.getAngle().getDegrees(), 
                    initialVel.getNorm()
                );
            }
        }
    }

    private static class TrajectoryInfo {
        public double angle;
        public double velocity;

        public TrajectoryInfo(double angle, double velocity) {
            this.angle = angle;
            this.velocity = velocity;
        }
    }
}