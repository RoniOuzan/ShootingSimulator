package com.shooting_simulator.json;

import java.util.ArrayList;
import java.util.List;

import com.shooting_simulator.simulation.*;
import com.shooting_simulator.simulation.obstacles.Obstacle;
import com.shooting_simulator.simulation.resolution.CenterResolution;
import org.java_websocket.WebSocket;

import com.shooting_simulator.SimulatorServer;
import com.shooting_simulator.util.math.geometry.Translation2d;

public class SimulatorPacket implements DataPacket {

    public double initialX;
    public double initialY;

    public double radialVelocity;
    
    public double targetY;
    public double targetRadius;
    public String targetAxis;
    
    // Limits
    public PhysicalValues physicalValues;
    public CostWeights costConfig;
    public List<Obstacle> obstacles;

    public String resolutionMode;

    public double minHitAngle;
    public double maxHitAngle;

    @Override
    public void handle(WebSocket conn, SimulatorServer server) {
        // Setup target and tolerances based on React's request
        Translation2d initialPos = new Translation2d(this.initialX, this.initialY);
        ResultsPayload payload = getResultsPayload(initialPos, this.targetY);

        // Send the results back to the React client that requested it!
        server.sendPacket(conn, "results", payload);
    }

    private ResultsPayload getResultsPayload(Translation2d initialPos, double targetY) {
        TrajectoryChooser chooser = new TrajectoryChooser(
                this.physicalValues,
                initialPos,
                this.radialVelocity,
                targetY,
                this.targetRadius,
                TargetAxis.valueOf(this.targetAxis),
                this.minHitAngle,
                this.maxHitAngle,
                this.costConfig,
                this.obstacles,
                CenterResolution.valueOf(this.resolutionMode)
        );

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
        public List<TrajectoryChooser.RobustnessPoint> robustnessData;
        public List<Translation2d> costData;

        public ResultsPayload(List<Trajectory> valid, Trajectory best, List<TrajectoryChooser.RobustnessPoint> robustnessData, List<Translation2d> costData) {
            this.trajectories = valid;
            this.bestTrajectory = best;
            this.robustnessData = robustnessData;
            this.costData = costData;
        }
    }
}