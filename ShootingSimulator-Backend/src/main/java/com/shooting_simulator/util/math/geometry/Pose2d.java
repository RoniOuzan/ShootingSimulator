package com.shooting_simulator.util.math.geometry;

import com.google.gson.Gson;

public class Pose2d {
    public final Translation2d translation;
    public final Rotation2d rotation;

    public Pose2d(Translation2d translation, Rotation2d rotation) {
        this.translation = translation;
        this.rotation = rotation;
    }

    // Apply a transform
    public Pose2d transformBy(Transform2d transform) {
        Translation2d newTranslation = translation.plus(transform.translation.rotateBy(rotation));
        Rotation2d newRotation = rotation.rotateBy(transform.rotation);
        return new Pose2d(newTranslation, newRotation);
    }

    public String toJson() {
        return new Gson().toJson(this);
    }

    @Override
    public String toString() {
        return "Pose2d(" + translation + ", " + rotation + ")";
    }
}

