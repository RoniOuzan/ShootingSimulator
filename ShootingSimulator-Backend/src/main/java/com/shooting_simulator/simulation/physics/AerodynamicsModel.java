package com.shooting_simulator.simulation.physics;

import com.shooting_simulator.simulation.records.PhysicalValues;
import com.shooting_simulator.util.math.geometry.Translation2d;

public class AerodynamicsModel {
    private static final double GRAVITY = -9.81;
    private static final double AIR_DENSITY = 1.225;

    private final PhysicalValues physicalValues;

    public AerodynamicsModel(PhysicalValues physicalValues) {
        this.physicalValues = physicalValues;
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
        double omega = this.getBallRPS(velocity.getNorm()) * (2 * Math.PI);

        // Calculate the Magnus scalar (v cancels out with the perpendicular vector normalizer)
        double magnusScalar = (0.5 * AIR_DENSITY * this.physicalValues.magnusCoeff * radius * omega * area) / this.physicalValues.mass;

        // The cross product of spin and velocity results in a perpendicular vector: (-Vy, Vx)
        return new Translation2d(-velocity.getY() * magnusScalar, velocity.getX() * magnusScalar);
    }

    private double getBallRPS(double velocity) {
        return this.physicalValues.spinRPSPerMS * velocity;
    }
}