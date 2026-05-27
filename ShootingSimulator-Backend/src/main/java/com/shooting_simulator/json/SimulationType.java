package com.shooting_simulator.json;

import com.shooting_simulator.simulation.*;
import com.shooting_simulator.simulation.obstacles.Obstacle;
import com.shooting_simulator.simulation.optimal.TrajectoryOptimalChooser;
import com.shooting_simulator.util.math.geometry.Translation2d;

import java.util.List;

public enum SimulationType {
    CENTER {
        @Override
        public TrajectoryChooser create(PhysicalValues physicalValues, Translation2d initialPosition, double radialVelocity, double targetY, double targetRadius, TargetAxis targetAxis, double minHitAngle, double maxHitAngle, CostWeights costWeights, List<Obstacle> obstacles) {
            return new TrajectoryChooser(physicalValues, initialPosition, radialVelocity, targetY, targetRadius, targetAxis, minHitAngle, maxHitAngle, costWeights, obstacles);
        }
    },
    OPTIMAL {
        @Override
        public TrajectoryOptimalChooser create(PhysicalValues physicalValues, Translation2d initialPosition, double radialVelocity, double targetY, double targetRadius, TargetAxis targetAxis, double minHitAngle, double maxHitAngle, CostWeights costWeights, List<Obstacle> obstacles) {
            return new TrajectoryOptimalChooser(physicalValues, initialPosition, radialVelocity, targetY, targetRadius, targetAxis, minHitAngle, maxHitAngle, costWeights, obstacles);
        }
    };

    public abstract Chooser create(PhysicalValues physicalValues, Translation2d initialPosition, double radialVelocity, double targetY, double targetRadius, TargetAxis targetAxis, double minHitAngle, double maxHitAngle, CostWeights costWeights, List<Obstacle> obstacles);
}
