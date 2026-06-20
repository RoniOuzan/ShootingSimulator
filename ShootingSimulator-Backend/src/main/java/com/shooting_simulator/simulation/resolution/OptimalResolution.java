package com.shooting_simulator.simulation.resolution;

import lombok.Getter;

@Getter
public enum OptimalResolution implements Resolution {
    FAST(0.01, 0.000_1, 0.000_1, 0.0005, 1),
    BALANCED(0.005, 0.000_01, 0.000_01, 0.001, 0.1),
    ACCURATE(0.002, 0.000_001, 0.000_001, 0.000_1, 0.01),
    ORBIT(0.002, 0.000_000_1, 0.000_000_1, 0.000_01, 0.001),
    ;

    private final double period;
    private final double velocity;
    private final double angle;
    private final double targetTolerance;
    private final double angleDX;

    OptimalResolution(double period, double velocity, double angle, double targetTolerance, double angleDX) {
        this.period = period;
        this.velocity = velocity;
        this.angle = angle;
        this.targetTolerance = targetTolerance;
        this.angleDX = angleDX;
    }
}
