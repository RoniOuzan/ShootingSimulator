package com.shooting_simulator.json;

import java.util.ArrayList;
import java.util.List;

import com.shooting_simulator.simulation.*;
import org.java_websocket.WebSocket;

import com.shooting_simulator.SimulatorServer;
import com.shooting_simulator.util.math.geometry.Translation2d;

public class CalculatePacket implements DataPacket {

    public double initialX;
    public double initialY;

    public double radialVelocity;
    
    public double targetX;
    public double targetY;

    public String targetAxis;
    
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
        TrajectoryChooser chooser = new TrajectoryChooser(this.physicalValues, initialPos, this.radialVelocity, target, TargetAxis.valueOf(this.targetAxis), this.minHitAngle, this.maxHitAngle);

        List<TrajectoryChooser.RobustnessPoint> rawRobustness = chooser.getRobustnessSweep();
         List<TrajectoryChooser.RobustnessPoint> downsampledRobustness = decimate(rawRobustness, 10);

        List<Trajectory> rawTrajectories = chooser.getTrajectories();
         List<Trajectory> downsampledTrajectories = new ArrayList<>();

         for (Trajectory t : rawTrajectories) {
             downsampledTrajectories.add(new Trajectory(decimate(t.getSamples(), 10), t.getHitSample(), t.isHitTarget(), t.getInitialShootingVelocity(), t.isFlat()));
         }

        return new ResultsPayload(downsampledTrajectories, chooser.findBestTrajectory(), downsampledRobustness, chooser.getCostSweep());
    }

    @SuppressWarnings("unused")
    private static class ResultsPayload {
        public List<Trajectory> trajectories;
        public Trajectory bestTrajectory;
        public TrajectoryInfo bestInfo;
        public List<TrajectoryChooser.RobustnessPoint> robustnessData;
        public List<Translation2d> costData;

        public ResultsPayload(List<Trajectory> valid, Trajectory best, List<TrajectoryChooser.RobustnessPoint> robustnessData, List<Translation2d> costData) {
            this.trajectories = valid;
            this.bestTrajectory = best;
            this.robustnessData = robustnessData;
            this.costData = costData;
            
            if (best != null && !best.getSamples().isEmpty()) {
                Translation2d initialVel = best.getInitialShootingVelocity();
                this.bestInfo = new TrajectoryInfo(
                    initialVel.getAngle().getDegrees(), 
                    initialVel.getNorm()
                );
            }
        }
    }

     private static <T> List<T> decimate(List<T> list, int stride) {
         if (list == null || list.isEmpty()) return list;
         List<T> decimated = new ArrayList<>();
         for (int i = 0; i < list.size(); i += stride) {
             decimated.add(list.get(i));
         }
         // Always include the last point to keep the endpoint accurate
         if ((list.size() - 1) % stride != 0) {
             decimated.add(list.get(list.size() - 1));
         }
         return decimated;
     }
}