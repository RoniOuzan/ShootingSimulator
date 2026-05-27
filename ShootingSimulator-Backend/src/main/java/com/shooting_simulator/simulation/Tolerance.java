package com.shooting_simulator.simulation;

import lombok.Getter;
import lombok.ToString;

@Getter
@ToString
public class Tolerance {
    private final double velocityPositive;
    private final double velocityNegative;
    private final double anglePositive;
    private final double angleNegative;
    private final double ellipseAngle;

    public Tolerance(double velocityPositive, double velocityNegative, double anglePositive, double angleNegative, double ellipseAngle) {
        this.velocityPositive = velocityPositive;
        this.velocityNegative = velocityNegative;
        this.anglePositive = anglePositive;
        this.angleNegative = angleNegative;
        this.ellipseAngle = ellipseAngle;
    }

    public Tolerance(double velocityPositive, double velocityNegative, double anglePositive, double angleNegative) {
        this(velocityPositive, velocityNegative, anglePositive, angleNegative, 0);
    }

    public static Tolerance symmetricTolerance(double velocity, double angle, double ellipseAngle) {
        return new Tolerance(velocity, velocity, angle, angle, ellipseAngle);
    }
}
