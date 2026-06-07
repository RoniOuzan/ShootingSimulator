package com.shooting_simulator.simulation.records;

import com.shooting_simulator.util.math.geometry.Translation2d;

public record ShooterState(
    Translation2d initialPosition,
    double radialVelocity
) {
}