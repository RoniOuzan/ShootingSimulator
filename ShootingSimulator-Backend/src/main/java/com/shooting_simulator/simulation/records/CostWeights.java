package com.shooting_simulator.simulation.records;

public record CostWeights(
        double robustnessWeight,
        double initialVelocityWeight,
        double impactVelocityWeight,
        double timeOfFlightWeight,
        double entryAngleWeight,
        double targetImpactAngle
) {}