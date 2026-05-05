package com.shooting_simulator.simulation;

import java.util.List;

import com.shooting_simulator.util.math.geometry.Translation2d;

import lombok.Getter;

@Getter
public class Trajectory {
    private final List<Sample> samples;
    private final Sample hitSample;
    private final boolean isHitTarget;
    private final boolean isReachedTargetHeight;
    private final Translation2d initialShootingVelocity;
    private final boolean isFlat;

    public Trajectory(List<Sample> samples, Sample hitSample, boolean isHitTarget, Translation2d initialShootingVelocity, boolean isFlat) {
        this.samples = samples;
        this.initialShootingVelocity = initialShootingVelocity;
        this.isHitTarget = isHitTarget;
        this.isReachedTargetHeight = hitSample != null;
        this.hitSample = hitSample;
        this.isFlat = isFlat;
    }

    public Sample getFinalSample() {
        return this.samples.get(this.samples.size() - 1);
    }

    public Sample getPeakSample() {
        Sample peak = this.samples.get(0);
        for (Sample sample : this.samples) {
            if (sample.getPosition().getY() > peak.getPosition().getY()) {
                peak = sample;
            } else {
                break;
            }
        }
        return peak;
    }
}
