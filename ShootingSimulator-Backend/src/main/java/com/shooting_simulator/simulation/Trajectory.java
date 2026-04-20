package com.shooting_simulator.simulation;

import com.shooting_simulator.util.math.geometry.Translation2d;
import lombok.Getter;

import java.util.List;

@Getter
public class Trajectory {
    private final Translation2d initialShootingVelocity;
    private final List<Sample> samples;

    public Trajectory(List<Sample> samples, Translation2d initialShootingVelocity) {
        this.samples = samples;
        this.initialShootingVelocity = initialShootingVelocity;
    }

    public Sample getFinalSample() {
        return this.samples.get(this.samples.size() - 1);
    }
}
