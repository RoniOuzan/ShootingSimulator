package com.shooting_simulator.simulation;

import com.shooting_simulator.util.math.geometry.Translation2d;

import java.util.function.Function;

public enum TargetAxis {
    HORIZONTAL(Translation2d::getY, Translation2d::getX, v -> new Translation2d(v, 0)),
    VERTICAL(Translation2d::getX, Translation2d::getY, v -> new Translation2d(0, v));

    private final Function<Translation2d, Double> targetAxis;
    private final Function<Translation2d, Double> errorAxis;
    private final Function<Double, Translation2d> creator;

    TargetAxis(Function<Translation2d, Double> targetAxis, Function<Translation2d, Double> errorAxis, Function<Double, Translation2d> creator) {
        this.targetAxis = targetAxis;
        this.errorAxis = errorAxis;
        this.creator = creator;
    }

    public double getTargetAxis(Translation2d translation2d) {
        return this.targetAxis.apply(translation2d);
    }

    public double getErrorAxis(Translation2d translation2d) {
        return this.errorAxis.apply(translation2d);
    }

    public Translation2d create(double value) {
        return this.creator.apply(value);
    }
}
