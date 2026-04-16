package com.shooting_simulator.simulation;

import com.shooting_simulator.util.math.geometry.Translation2d;
import lombok.Getter;

import java.util.List;

@Getter
public class Trajectory {
    private final List<Sample> samples;

    public Trajectory(List<Sample> samples) {
        this.samples = samples;
    }

    public Sample getInitialSample() {
        return this.samples.get(0);
    }

    public Sample getFinalSample() {
        return this.samples.get(this.samples.size() - 1);
    }

    public double getErrorFromTarget(Translation2d target) {
        return this.getFinalSample().getPosition().getX() - target.getX();
    }
}
