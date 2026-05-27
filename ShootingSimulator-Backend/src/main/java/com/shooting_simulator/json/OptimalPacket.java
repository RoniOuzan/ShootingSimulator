package com.shooting_simulator.json;

import com.shooting_simulator.SimulatorServer;
import com.shooting_simulator.simulation.*;
import com.shooting_simulator.simulation.optimal.TrajectoryCouple;
import com.shooting_simulator.simulation.optimal.TrajectoryOptimalChooser;
import com.shooting_simulator.simulation.obstacles.Obstacle;
import com.shooting_simulator.util.math.geometry.Translation2d;
import org.java_websocket.WebSocket;

import java.util.List;

public class OptimalPacket implements DataPacket {

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

    public double minHitAngle;
    public double maxHitAngle;

    @Override
    public void handle(WebSocket conn, SimulatorServer server) {
        Translation2d initialPos = new Translation2d(this.initialX, this.initialY);
        ResultsPayload payload = getResultsPayload(initialPos, this.targetY);

        server.sendPacket(conn, "optimalResults", payload);
    }

    private ResultsPayload getResultsPayload(Translation2d initialPos, double targetY) {
        TrajectoryOptimalChooser chooser = new TrajectoryOptimalChooser(
                this.physicalValues,
                initialPos,
                this.radialVelocity,
                targetY,
                this.targetRadius,
                TargetAxis.valueOf(this.targetAxis),
                this.minHitAngle,
                this.maxHitAngle,
                this.costConfig,
                this.obstacles
        );

        List<TrajectoryChooser.RobustnessPoint> rawRobustness = chooser.getRobustnessSweep();
        List<TrajectoryChooser.RobustnessPoint> downsampledRobustness = decimate(rawRobustness, 10);

        List<TrajectoryCouple> trajectories = chooser.calculateTrajectories();

        return new ResultsPayload(trajectories,  chooser.getBestTrajectory(), downsampledRobustness, chooser.getCostSweep());
    }

    @SuppressWarnings("unused")
    private static class ResultsPayload {
        public List<TrajectoryCouple> trajectories;
        public Trajectory bestTrajectory;
        public List<TrajectoryChooser.RobustnessPoint> robustnessData;
        public List<Translation2d> costData;

        public ResultsPayload(List<TrajectoryCouple> trajectories, Trajectory bestTrajectory, List<TrajectoryChooser.RobustnessPoint> robustnessData, List<Translation2d> costData) {
            this.trajectories = trajectories;
            this.bestTrajectory = bestTrajectory;
            this.robustnessData = robustnessData;
            this.costData = costData;
        }
    }
}
