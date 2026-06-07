package com.shooting_simulator.simulation.records;

import com.shooting_simulator.util.math.geometry.Translation2d;

public record TargetConfig(
    Translation2d center,
    double radius,
    TargetAxis axis,
    double minHitAngle,
    double maxHitAngle
) {
    public TargetConfig moveBy(Translation2d offset) {
        return new TargetConfig(
                center.plus(offset),
                radius,
                axis,
                minHitAngle,
                maxHitAngle
        );
    }
}