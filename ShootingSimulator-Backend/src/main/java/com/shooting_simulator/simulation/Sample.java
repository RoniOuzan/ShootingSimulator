package com.shooting_simulator.simulation;

import com.shooting_simulator.util.math.geometry.Translation2d;
import lombok.Getter;

@Getter
public class Sample {
    private final Translation2d position;
    private final Translation2d velocity;

    public Sample(Translation2d position, Translation2d velocity) {
        this.position = position;
        this.velocity = velocity;
    }
}
