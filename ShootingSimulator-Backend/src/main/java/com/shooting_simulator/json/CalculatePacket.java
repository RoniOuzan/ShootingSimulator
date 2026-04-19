package com.shooting_simulator.json;

import com.shooting_simulator.SimulatorServer;
import com.shooting_simulator.simulation.PhysicalValues;
import com.shooting_simulator.simulation.TrajectoryChooser;
import com.shooting_simulator.simulation.Trajectory;
import com.shooting_simulator.util.math.geometry.Translation2d;
import org.java_websocket.WebSocket;

import java.util.List;

public class CalculatePacket implements DataPacket {

    public double initialX;
    public double initialY;
    
    public double targetX;
    public double targetY;
    
    public double tolX;
    public double tolY;

    // Limits
    public PhysicalValues physicalValues;

    public double minHitAngle;
    public double maxHitAngle;

    @Override
    public void handle(WebSocket conn, SimulatorServer server) {
        // Setup target and tolerances based on React's request
        Translation2d initialPos = new Translation2d(this.initialX, this.initialY);
        Translation2d target = new Translation2d(this.targetX, this.targetY);
        ResultsPayload payload = getResultsPayload(initialPos, target);

        // Send the results back to the React client that requested it!
        server.sendPacket(conn, "results", payload);
    }

    private ResultsPayload getResultsPayload(Translation2d initialPos, Translation2d target) {
        Translation2d targetTolerance = new Translation2d(this.tolX, this.tolY);

        // Run the math
        TrajectoryChooser chooser = new TrajectoryChooser(this.physicalValues, initialPos, target, targetTolerance, this.minHitAngle, this.maxHitAngle);
        List<Trajectory> validTrajectories = chooser.getTrajectories();
        Trajectory bestTrajectory = chooser.getBestTrajectory();

        List<TrajectoryChooser.RobustnessPoint> robustnessData = chooser.generateRobustnessSweep();

        // Create a payload object to hold the results
        return new ResultsPayload(validTrajectories, bestTrajectory, robustnessData);
    }

    // Inner class representing the JSON structure React expects back
    private static class ResultsPayload {
        public List<Trajectory> trajectories;
        public Trajectory bestTrajectory;
        public TrajectoryInfo bestInfo;
        public List<TrajectoryChooser.RobustnessPoint> robustnessData;

        public ResultsPayload(List<Trajectory> valid, Trajectory best, List<TrajectoryChooser.RobustnessPoint> robustnessData) {
            this.trajectories = valid;
            this.bestTrajectory = best;
            this.robustnessData = robustnessData;
            
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