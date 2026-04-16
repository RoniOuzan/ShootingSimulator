package com.shooting_simulator.simulation;

public class PhysicalValues {
    public double minAngle;
    public double maxAngle;
    public double minVel;
    public double maxVel;

    public double estimatedVelocityError;
    public double estimatedAngleError;

    public PhysicalValues(double minAngle, double maxAngle, double minVel, double maxVel, double estimatedVelocityError, double estimatedAngleError) {
        this.minAngle = minAngle;
        this.maxAngle = maxAngle;
        this.minVel = minVel;
        this.maxVel = maxVel;
        this.estimatedVelocityError = estimatedVelocityError;
        this.estimatedAngleError = estimatedAngleError;
    }
}
