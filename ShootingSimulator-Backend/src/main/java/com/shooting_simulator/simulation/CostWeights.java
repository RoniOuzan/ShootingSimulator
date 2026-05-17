package com.shooting_simulator.simulation;

public record CostWeights(
        double robustnessWeight,
        double initialVelocityWeight,
        double impactVelocityWeight,
        double timeOfFlightWeight,
        double entryAngleWeight,
        double targetImpactAngle
) {}