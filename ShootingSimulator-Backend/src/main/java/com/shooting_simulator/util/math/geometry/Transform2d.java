package com.shooting_simulator.util.math.geometry;

import com.google.gson.Gson;

public class Transform2d {
    public final Translation2d translation;
    public final Rotation2d rotation;

    public Transform2d(Translation2d translation, Rotation2d rotation) {
        this.translation = translation;
        this.rotation = rotation;
    }

    public String toJson() {
        return new Gson().toJson(this);
    }

    @Override
    public String toString() {
        return "Transform2d(" + translation + ", " + rotation + ")";
    }
}
