package com.shooting_simulator.json;

import com.shooting_simulator.SimulatorServer;
import com.shooting_simulator.simulation.*;
import com.shooting_simulator.simulation.optimal.TrajectoryCouple;
import com.shooting_simulator.simulation.optimal.TrajectoryOptimalChooser;
import com.shooting_simulator.simulation.obstacles.Obstacle;
import com.shooting_simulator.simulation.records.CostWeights;
import com.shooting_simulator.simulation.records.PhysicalValues;
import com.shooting_simulator.simulation.records.TargetConfig;
import com.shooting_simulator.simulation.resolution.OptimalResolution;
import com.shooting_simulator.util.math.geometry.Translation2d;
import org.java_websocket.WebSocket;

import java.util.List;

public class OptimalPacket implements DataPacket {

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
        TrajectoryOptimalChooser chooser = new TrajectoryOptimalChooser(
                this.origin.getState(this.initialX),
                this.target,
                this.physicalValues,
                this.cost,
                this.obstacles,
                OptimalResolution.valueOf(this.resolutionMode)
        );

        List<TrajectoryCenterChooser.RobustnessPoint> rawRobustness = chooser.getRobustnessSweep();
        List<TrajectoryCenterChooser.RobustnessPoint> downsampledRobustness = decimate(rawRobustness, 10);

        List<TrajectoryCouple> trajectories = chooser.calculateTrajectories();

        ResultsPayload payload = new ResultsPayload(trajectories,  chooser.getBestTrajectory(), downsampledRobustness, chooser.getCostSweep(), chooser.getVelocityGapSweep(), chooser.getGapDerivativeSweep());

        server.sendPacket(conn, "optimalResults", payload);
    }

    @SuppressWarnings("unused")
    private static class ResultsPayload {
        public List<TrajectoryCouple> trajectories;
        public Trajectory bestTrajectory;
        public List<TrajectoryCenterChooser.RobustnessPoint> robustnessData;
        public List<Translation2d> costData;
        public List<Translation2d> velocityGapData;
        public List<Translation2d> gapDerivativeData;

        public ResultsPayload(List<TrajectoryCouple> trajectories, Trajectory bestTrajectory, List<TrajectoryCenterChooser.RobustnessPoint> robustnessData, List<Translation2d> costData, List<Translation2d> velocityGapData, List<Translation2d> gapDerivativeData) {
            this.trajectories = trajectories;
            this.bestTrajectory = bestTrajectory;
            this.robustnessData = robustnessData;
            this.costData = costData;
            this.velocityGapData = velocityGapData;
            this.gapDerivativeData = gapDerivativeData;
        }
    }
}
