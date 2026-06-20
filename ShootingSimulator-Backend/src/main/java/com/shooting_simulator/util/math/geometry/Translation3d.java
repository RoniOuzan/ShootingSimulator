// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package com.shooting_simulator.util.math.geometry;

import com.shooting_simulator.util.math.MathUtil;
import com.shooting_simulator.util.math.interpolation.Interpolatable;

import java.util.Objects;

/**
 * Represents a translation in 3D space. This object can be used to represent a point or a vector.
 *
 * <p>This assumes that you are using conventional mathematical axes. When the robot is at the
 * origin facing in the positive X direction, forward is positive X, left is positive Y, and up is
 * positive Z.
 */
public class Translation3d implements Interpolatable<Translation3d> {
    /**
     * A preallocated Translation3d representing the origin.
     *
     * <p>This exists to avoid allocations for common translations.
     */
    public static final Translation3d kZero = new Translation3d();

    private final double x;
    private final double y;
    private final double z;

    /** Constructs a Translation3d with X, Y, and Z components equal to zero. */
    public Translation3d() {
        this(0.0, 0.0, 0.0);
    }

    /**
     * Constructs a Translation3d with the X, Y, and Z components equal to the provided values.
     *
     * @param x The x component of the translation.
     * @param y The y component of the translation.
     * @param z The z component of the translation.
     */
    public Translation3d(double x, double y, double z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    /**
     * Constructs a 3D translation from a 2D translation in the X-Y plane.
     *
     * @param translation The 2D translation.
     */
    public Translation3d(Translation2d translation) {
        this(translation, 0.0);
    }

    public Translation3d(Translation2d translation, double z) {
        this(translation.getX(), translation.getY(), z);
    }


    /**
     * Constructs a Translation2d with the provided distance and angle. This is essentially converting
     * from polar coordinates to Cartesian coordinates.
     *
     * @param distance The distance from the origin to the end of the translation.
     * @param angle The angle between the x-axis and the translation vector.
     */
    public Translation3d(double distance, Rotation2d angle, double z) {
        this.x = distance * angle.getCos();
        this.y = distance * angle.getSin();
        this.z = z;
    }

    /**
     * Calculates the distance between two translations in 3D space.
     *
     * <p>The distance between translations is defined as √((x₂−x₁)²+(y₂−y₁)²+(z₂−z₁)²).
     *
     * @param other The translation to compute the distance to.
     * @return The distance between the two translations.
     */
    public double getDistance(Translation3d other) {
        return Math.sqrt(Math.pow(other.x - x, 2) + Math.pow(other.y - y, 2) + Math.pow(other.z - z, 2));
    }

    public double getDistance(Translation2d other) {
        return Math.sqrt(Math.pow(other.getX() - this.x, 2) + Math.pow(other.getY() - this.y, 2) + Math.pow(this.z, 2));
    }

    /**
     * Returns the X component of the translation.
     *
     * @return The X component of the translation.
     */
    public double getX() {
        return this.x;
    }

    /**
     * Returns the Y component of the translation.
     *
     * @return The Y component of the translation.
     */
    public double getY() {
        return this.y;
    }

    /**
     * Returns the Z component of the translation.
     *
     * @return The Z component of the translation.
     */
    public double getZ() {
        return this.z;
    }


    /**
     * Returns the norm, or distance from the origin to the translation.
     *
     * @return The norm of the translation.
     */
    public double getNorm() {
        return Math.sqrt(x * x + y * y + z * z);
    }


    /**
     * Returns a Translation2d representing this Translation3d projected into the X-Y plane.
     *
     * @return A Translation2d representing this Translation3d projected into the X-Y plane.
     */
    public Translation2d toTranslation2d() {
        return new Translation2d(x, y);
    }

    public Translation3d normalized() {
        if (this.getNorm() < 1e-9) {
            return new Translation3d();
        }

        return this.div(this.getNorm());
    }

    public Translation3d limitNorm(double maximum) {
        double norm = this.getNorm();
        if (norm > maximum) {
            return this.times(maximum / norm);
        }
        return this;
    }

    /**
     * Returns the sum of two translations in 3D space.
     *
     * <p>For example, Translation3d(1.0, 2.5, 3.5) + Translation3d(2.0, 5.5, 7.5) =
     * Translation3d{3.0, 8.0, 11.0).
     *
     * @param other The translation to add.
     * @return The sum of the translations.
     */
    public Translation3d plus(Translation3d other) {
        return new Translation3d(x + other.x, y + other.y, z + other.z);
    }

    /**
     * Returns the difference between two translations.
     *
     * <p>For example, Translation3d(5.0, 4.0, 3.0) - Translation3d(1.0, 2.0, 3.0) =
     * Translation3d(4.0, 2.0, 0.0).
     *
     * @param other The translation to subtract.
     * @return The difference between the two translations.
     */
    public Translation3d minus(Translation3d other) {
        return new Translation3d(x - other.x, y - other.y, z - other.z);
    }

    /**
     * Returns the inverse of the current translation. This is equivalent to negating all components
     * of the translation.
     *
     * @return The inverse of the current translation.
     */
    public Translation3d unaryMinus() {
        return new Translation3d(-x, -y, -z);
    }

    /**
     * Returns the translation multiplied by a scalar.
     *
     * <p>For example, Translation3d(2.0, 2.5, 4.5) * 2 = Translation3d(4.0, 5.0, 9.0).
     *
     * @param scalar The scalar to multiply by.
     * @return The scaled translation.
     */
    public Translation3d times(double scalar) {
        return new Translation3d(x * scalar, y * scalar, z * scalar);
    }

    /**
     * Returns the translation divided by a scalar.
     *
     * <p>For example, Translation3d(2.0, 2.5, 4.5) / 2 = Translation3d(1.0, 1.25, 2.25).
     *
     * @param scalar The scalar to multiply by.
     * @return The reference to the new mutated object.
     */
    public Translation3d div(double scalar) {
        return new Translation3d(x / scalar, y / scalar, z / scalar);
    }

    public Translation3d crossProduct(Translation3d other) {
        return new Translation3d(
                this.y * other.z - this.z * other.y,
                this.z * other.x - this.x * other.z,
                this.x * other.y - this.y * other.x
        );
    }

    @Override
    public String toString() {
        return String.format("Translation3d(X: %.2f, Y: %.2f, Z: %.2f)", x, y, z);
    }

    /**
     * Checks equality between this Translation3d and another object.
     *
     * @param obj The other object.
     * @return Whether the two objects are equal or not.
     */
    @Override
    public boolean equals(Object obj) {
        return obj instanceof Translation3d other
                && Math.abs(other.x - x) < 1E-9
                && Math.abs(other.y - y) < 1E-9
                && Math.abs(other.z - z) < 1E-9;
    }

    @Override
    public int hashCode() {
        return Objects.hash(x, y, z);
    }

    @Override
    public Translation3d interpolate(Translation3d endValue, double t) {
        return new Translation3d(
                MathUtil.interpolate(this.getX(), endValue.getX(), t),
                MathUtil.interpolate(this.getY(), endValue.getY(), t),
                MathUtil.interpolate(this.getZ(), endValue.getZ(), t));
    }
}
