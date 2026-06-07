package com.shooting_simulator.json;

import com.shooting_simulator.simulation.records.ShooterState;
import com.shooting_simulator.util.math.geometry.Translation2d;

public record OriginParams(double initialY, double radialVelocity) {
    public ShooterState getState(double x) {
        return new ShooterState(
                new Translation2d(x, initialY),
                radialVelocity
        );
    }

    public ShooterState getState() {
        return getState(0);
    }
}
