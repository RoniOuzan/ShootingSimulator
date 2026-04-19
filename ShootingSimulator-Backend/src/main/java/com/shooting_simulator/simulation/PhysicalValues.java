package com.shooting_simulator.simulation;

import lombok.AllArgsConstructor;

@AllArgsConstructor
public class PhysicalValues {
    public double minAngle;
    public double maxAngle;
    public double minVel;
    public double maxVel;

    public double estimatedVelocityError;
    public double estimatedAngleError;

    public double mass;
    public double diameter;
    public double dragCoeff;
    public double spinRPS;
    public double magnusCoeff;
}
