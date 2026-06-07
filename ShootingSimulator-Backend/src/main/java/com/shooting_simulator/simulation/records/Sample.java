package com.shooting_simulator.simulation.records;

import com.shooting_simulator.util.math.geometry.Translation2d;
import lombok.Getter;

@Getter
public class Sample {
    private final double time;
    private final Translation2d position;
    private final Translation2d velocity;
    private final Translation2d acceleration;

    public Sample(Translation2d position, Translation2d velocity, Translation2d acceleration, double time) {
        this.position = position;
        this.velocity = velocity;
        this.acceleration = acceleration;
        this.time = time;
    }
}
