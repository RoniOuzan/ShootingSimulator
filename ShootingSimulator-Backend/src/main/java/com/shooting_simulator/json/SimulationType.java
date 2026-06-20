package com.shooting_simulator.json;

import com.shooting_simulator.simulation.*;
import com.shooting_simulator.simulation.obstacles.Obstacle;
import com.shooting_simulator.simulation.optimal.TrajectoryOptimalChooser;
import com.shooting_simulator.simulation.records.CostWeights;
import com.shooting_simulator.simulation.records.PhysicalValues;
import com.shooting_simulator.simulation.records.ShooterState;
import com.shooting_simulator.simulation.records.TargetConfig;
import com.shooting_simulator.simulation.resolution.CenterResolution;
import com.shooting_simulator.simulation.resolution.OptimalResolution;

import java.util.List;

public enum SimulationType {
    CENTER {
        @Override
        public TrajectoryCenterChooser create(ShooterState state, TargetConfig target, PhysicalValues physicalValues, CostWeights costWeights, List<Obstacle> obstacles, String resolution) {
            return new TrajectoryCenterChooser(state, target, physicalValues, costWeights, obstacles, CenterResolution.valueOf(resolution));
        }
    },
    OPTIMAL {
        @Override
        public TrajectoryOptimalChooser create(ShooterState state, TargetConfig target, PhysicalValues physicalValues, CostWeights costWeights, List<Obstacle> obstacles, String resolution) {
            return new TrajectoryOptimalChooser(state, target, physicalValues, costWeights, obstacles, OptimalResolution.valueOf(resolution));
        }
    };

    public abstract Chooser create(ShooterState state, TargetConfig target, PhysicalValues physicalValues, CostWeights costWeights, List<Obstacle> obstacles, String resolution);
}
