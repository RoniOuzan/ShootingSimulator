package com.shooting_simulator.simulation.resolution;

import lombok.Getter;

@Getter
public enum CenterResolution implements Resolution {
    FAST(0.01, 0.001, 0.001, 0.001),
    BALANCED(0.005, 0.000_1, 0.000_1, 0.001),
    ACCURATE(0.002, 0.000_01, 0.000_01, 0.0001),
    ORBIT(0.002, 0.000_001, 0.000_001, 0.00001),
    ;

    private final double period;
    private final double velocity;
    private final double angle;
    private final double targetTolerance;

    CenterResolution(double period, double velocity, double angle, double targetTolerance) {
        this.period = period;
        this.velocity = velocity;
        this.angle = angle;
        this.targetTolerance = targetTolerance;
    }
}
