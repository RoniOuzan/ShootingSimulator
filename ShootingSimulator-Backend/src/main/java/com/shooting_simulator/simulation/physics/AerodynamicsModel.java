package com.shooting_simulator.simulation.physics;

import com.shooting_simulator.simulation.records.PhysicalValues;
import com.shooting_simulator.util.math.geometry.Translation2d;

public class AerodynamicsModel {
    private static final double GRAVITY = -9.81;
    private static final double AIR_DENSITY = 1.225;

    private final PhysicalValues physicalValues;
    private final ProjectileShape shape;

    public AerodynamicsModel(PhysicalValues physicalValues) {
        this.physicalValues = physicalValues;
        this.shape = ProjectileShape.valueOf(physicalValues.shape);
    }

    public Translation2d calculateAcceleration(Translation2d velocity) {
        Translation2d gravity = new Translation2d(0, GRAVITY);
        if (velocity.getNorm() <= 0.001) return gravity;

        double area = Math.PI * Math.pow(this.physicalValues.radius, 2);
        return gravity.plus(calculateDrag(velocity, area))
                      .plus(calculateMagnus(velocity, this.physicalValues.radius, area));
    }

    private Translation2d calculateDrag(Translation2d velocity, double area) {
        double vMag = velocity.getNorm();

        // F_d = 0.5 * rho * v^2 * C_d * A
        double dragForce = 0.5 * AIR_DENSITY * (vMag * vMag) * this.physicalValues.dragCoeff * area;
        // a = F / m
        double dragAccMag = dragForce / this.physicalValues.mass;

        // Drag always opposes the velocity vector
        return velocity.div(vMag).times(-dragAccMag);
    }

    private Translation2d calculateMagnus(Translation2d velocity, double radius, double area) {
        double vMag = velocity.getNorm();
        if (vMag <= 0.001) return new Translation2d(0, 0);

        // ω (rad/s) = (spinRPSPerMS * v) * 2π
        double omega = (this.physicalValues.spinRPSPerMS * vMag) * (2 * Math.PI);

        // Fetch the inner radius (defaults to 0.0 if not set or not applicable)
        double innerRadius = this.physicalValues.innerRadius;

        // Delegate to the Enum!
        double forceMag = this.shape.calculateMagnusForce(
                vMag,
                omega,
                radius,
                innerRadius,
                area,
                AIR_DENSITY
        );

        double accMag = forceMag / this.physicalValues.mass;

        // Standard Magnus force acts perpendicular to the velocity vector
        return new Translation2d(-velocity.getY(), velocity.getX()).div(vMag).times(accMag);
    }
}