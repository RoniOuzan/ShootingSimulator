package com.shooting_simulator.json;

import java.util.ArrayList;
import java.util.List;

import com.shooting_simulator.simulation.*;
import com.shooting_simulator.simulation.obstacles.Obstacle;
import com.shooting_simulator.simulation.records.CostWeights;
import com.shooting_simulator.simulation.records.PhysicalValues;
import com.shooting_simulator.simulation.records.TargetConfig;
import com.shooting_simulator.simulation.resolution.CenterResolution;
import org.java_websocket.WebSocket;

import com.shooting_simulator.SimulatorServer;
import com.shooting_simulator.util.math.geometry.Translation2d;

public class SimulatorPacket implements DataPacket {

    public double initialX;
    public OriginParams origin;

    public TargetConfig target;
    
    // Limits
    public PhysicalValues physicalValues;
    public CostWeights cost;
    public List<Obstacle> obstacles;

    public String resolutionMode;

    @Override
    public void handle(WebSocket conn, SimulatorServer server) {
        TrajectoryCenterChooser chooser = new TrajectoryCenterChooser(
                this.origin.getState(this.initialX),
                this.target,
                this.physicalValues,
                this.cost,
                this.obstacles,
                CenterResolution.valueOf(this.resolutionMode)
        );

        List<TrajectoryCenterChooser.RobustnessPoint> rawRobustness = chooser.getRobustnessSweep();
        List<TrajectoryCenterChooser.RobustnessPoint> downsampledRobustness = decimate(rawRobustness, 10);

        List<Trajectory> rawTrajectories = chooser.getTrajectories();
        List<Trajectory> downsampledTrajectories = new ArrayList<>();

        for (Trajectory t : rawTrajectories) {
            downsampledTrajectories.add(new Trajectory(decimate(t.getSamples(), 10), t.getHitSample(), t.isHitTarget(), t.getInitialShootingVelocity(), t.isFlat()));
        }

        ResultsPayload payload = new ResultsPayload(downsampledTrajectories, chooser.findBestTrajectory(), downsampledRobustness, chooser.getCostSweep());

        // Send the results back to the React client that requested it!
        server.sendPacket(conn, "results", payload);
    }

    @SuppressWarnings("unused")
    private static class ResultsPayload {
        public List<Trajectory> trajectories;
        public Trajectory bestTrajectory;
        public List<TrajectoryCenterChooser.RobustnessPoint> robustnessData;
        public List<Translation2d> costData;

        public ResultsPayload(List<Trajectory> valid, Trajectory best, List<TrajectoryCenterChooser.RobustnessPoint> robustnessData, List<Translation2d> costData) {
            this.trajectories = valid;
            this.bestTrajectory = best;
            this.robustnessData = robustnessData;
            this.costData = costData;
        }
    }
}