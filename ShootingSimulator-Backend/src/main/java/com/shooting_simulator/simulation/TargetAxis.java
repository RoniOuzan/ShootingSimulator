package com.shooting_simulator.simulation;

import com.shooting_simulator.util.math.geometry.Translation2d;

import java.util.function.Function;

public enum TargetAxis {
    HORIZONTAL(Translation2d::getY, Translation2d::getX),
    VERTICAL(Translation2d::getX, Translation2d::getY);

    private final Function<Translation2d, Double> targetAxis;
    private final Function<Translation2d, Double> errorAxis;

    TargetAxis(Function<Translation2d, Double> targetAxis, Function<Translation2d, Double> errorAxis) {
        this.targetAxis = targetAxis;
        this.errorAxis = errorAxis;
    }

    public double getTargetAxis(Translation2d translation2d) {
        return this.targetAxis.apply(translation2d);
    }

    public double getErrorAxis(Translation2d translation2d) {
        return this.errorAxis.apply(translation2d);
    }
}
