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

    public Tolerance(double velocityPositive, double velocityNegative, double anglePositive, double angleNegative) {
        this.velocityPositive = velocityPositive;
        this.velocityNegative = velocityNegative;
        this.anglePositive = anglePositive;
        this.angleNegative = angleNegative;
    }
}
