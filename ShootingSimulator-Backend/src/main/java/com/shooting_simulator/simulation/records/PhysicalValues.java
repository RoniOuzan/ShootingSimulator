package com.shooting_simulator.simulation.records;

import lombok.AllArgsConstructor;
import lombok.ToString;

@AllArgsConstructor
@ToString
public class PhysicalValues {
    public double minAngle;
    public double maxAngle;
    public double minVel;
    public double maxVel;

    public double velocityRobustness;
    public double angleRobustness;

    public double angleError;
    public double velocityError;

    public double mass;
    public double radius;
    public double innerRadius;
    public double dragCoeff;
    public double spinRPSPerMS;
    public String shape;
}
