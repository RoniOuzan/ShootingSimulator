package com.shooting_simulator;

import com.shooting_simulator.util.math.MathUtil;

/**
 * Interface for interchangeable ballistics profiles.
 */
interface ShooterProfile {
    double calculateAngle(double d, double vr);
    double getAngleDerivativeWrtDistance(double d, double vr);
    double getAngleDerivativeWrtRadialVelocity(double d, double vr);
    double getAngleSecondDerivativeWrtDistance(double d, double vr);
    double getAngleMixedDerivative(double d, double vr);
    
    double calculateVelocity(double d, double vr);
    double getVelocityDerivativeWrtDistance(double d, double vr);
    double getVelocitySecondDerivativeWrtDistance(double d, double vr);
    
    double predictAngle(double d, double vr, double accel, double dt);
}

/**
 * Auto-generated Ballistic Profile with Hessian support for curvature compensation.
 */
public class GeneratedShooterProfile implements ShooterProfile {

    // ── Hardware Constraints ─────────────────────────────────────────────────
    public final double MIN_SAFE_ANGLE = 50.00;
    public final double MAX_SAFE_ANGLE = 90.00;

    public GeneratedShooterProfile() {}

    // ── Angle Prediction ─────────────────────────────────────────────────────

    @Override
    public double calculateAngle(double d, double vr) {
        double angle = (88.3866434591) -
           (10.1575970216 * d) +
           (8.7729154307 * vr) +
           (1.7987405454 * d * d) -
           (0.9800616333 * d * vr) +
           (0.1760299257 * vr * vr) -
           (0.2292401100 * d * d * d) +
           (0.1106533024 * d * d * vr) -
           (0.0028073999 * d * vr * vr) -
           (0.0222712019 * vr * vr * vr) +
           (0.0125772131 * d * d * d * d) -
           (0.0077715840 * d * d * d * vr) +
           (0.0026394367 * d * d * vr * vr) +
           (0.0001369103 * d * vr * vr * vr) +
           (0.0003383438 * vr * vr * vr * vr);
        return MathUtil.clamp(angle, MIN_SAFE_ANGLE, MAX_SAFE_ANGLE);
    }

    /** 1st Partial Derivative: ∂Angle / ∂Distance */
    @Override
    public double getAngleDerivativeWrtDistance(double d, double vr) {
        return  -
           (10.1575970216) +
           (3.5974810907 * d) -
           (0.9800616333 * vr) -
           (0.6877203299 * d * d) +
           (0.2213066048 * d * vr) -
           (0.0028073999 * vr * vr) +
           (0.0503088525 * d * d * d) -
           (0.0233147521 * d * d * vr) +
           (0.0052788734 * d * vr * vr) +
           (0.0001369103 * vr * vr * vr);
    }

    /** 1st Partial Derivative: ∂Angle / ∂RadialVelocity */
    @Override
    public double getAngleDerivativeWrtRadialVelocity(double d, double vr) {
        return (8.7729154307) -
           (0.9800616333 * d) +
           (0.3520598515 * vr) +
           (0.1106533024 * d * d) -
           (0.0056147999 * d * vr) -
           (0.0668136056 * vr * vr) -
           (0.0077715840 * d * d * d) +
           (0.0052788734 * d * d * vr) +
           (0.0004107308 * d * vr * vr) +
           (0.0013533750 * vr * vr * vr);
    }

    /** 2nd Partial Derivative: ∂²Angle / ∂Distance² */
    @Override
    public double getAngleSecondDerivativeWrtDistance(double d, double vr) {
        return (3.5974810907) -
           (1.3754406598 * d) +
           (0.2213066048 * vr) +
           (0.1509265575 * d * d) -
           (0.0466295041 * d * vr) +
           (0.0052788734 * vr * vr);
    }

    /** Mixed Partial Derivative: ∂²Angle / ∂Distance∂RadialVelocity */
    @Override
    public double getAngleMixedDerivative(double d, double vr) {
        return  -
           (0.9800616333) +
           (0.2213066048 * d) -
           (0.0056147999 * vr) -
           (0.0233147521 * d * d) +
           (0.0105577468 * d * vr) +
           (0.0004107308 * vr * vr);
    }

    // ── Velocity Prediction ──────────────────────────────────────────────────

    @Override
    public double calculateVelocity(double d, double vr) {
        double angle = calculateAngle(d, vr);
        if (angle <= MIN_SAFE_ANGLE) return (4.9278359963) +
           (0.9550074110 * d) -
           (0.3844562311 * vr) -
           (0.0264636114 * d * d) -
           (0.0285728897 * d * vr) +
           (0.0687700117 * vr * vr);
        if (angle >= MAX_SAFE_ANGLE) return (6.9546452176) +
           (2.2436861264 * d) -
           (1.8245088738 * vr) +
           (0.3513467532 * d * d) -
           (0.9594817938 * d * vr) +
           (0.5426858030 * vr * vr);
        return (6.5004547239) +
           (0.5703919765 * d) -
           (0.0714383477 * vr) +
           (0.0107167267 * d * d) -
           (0.1338828065 * d * vr) +
           (0.0639645855 * vr * vr) -
           (0.0030227003 * d * d * d) +
           (0.0178530372 * d * d * vr) -
           (0.0084914794 * d * vr * vr) +
           (0.0007336374 * vr * vr * vr) +
           (0.0002140932 * d * d * d * d) -
           (0.0012206655 * d * d * d * vr) +
           (0.0008041579 * d * d * vr * vr) -
           (0.0001706146 * d * vr * vr * vr) -
           (0.0000420354 * vr * vr * vr * vr);
    }

    /** 1st Partial Derivative: ∂Velocity / ∂Distance */
    @Override
    public double getVelocityDerivativeWrtDistance(double d, double vr) {
        double angle = calculateAngle(d, vr);
        if (angle <= MIN_SAFE_ANGLE) return (0.9550074110) -
           (0.0529272229 * d) -
           (0.0285728897 * vr);
        if (angle >= MAX_SAFE_ANGLE) return (2.2436861264) +
           (0.7026935065 * d) -
           (0.9594817938 * vr);
        return (0.5703919765) +
           (0.0214334535 * d) -
           (0.1338828065 * vr) -
           (0.0090681008 * d * d) +
           (0.0357060745 * d * vr) -
           (0.0084914794 * vr * vr) +
           (0.0008563730 * d * d * d) -
           (0.0036619964 * d * d * vr) +
           (0.0016083158 * d * vr * vr) -
           (0.0001706146 * vr * vr * vr);
    }

    /** 2nd Partial Derivative: ∂²Velocity / ∂Distance² */
    @Override
    public double getVelocitySecondDerivativeWrtDistance(double d, double vr) {
        double angle = calculateAngle(d, vr);
        if (angle <= MIN_SAFE_ANGLE) return  -
           (0.0529272229);
        if (angle >= MAX_SAFE_ANGLE) return (0.7026935065);
        return (0.0214334535) -
           (0.0181362016 * d) +
           (0.0357060745 * vr) +
           (0.0025691190 * d * d) -
           (0.0073239928 * d * vr) +
           (0.0016083158 * vr * vr);
    }

    // ── Advanced Control ─────────────────────────────────────────────────────

    /**
     * Calculates the estimated optimal angle adjusting for latency and acceleration.
     * Uses a Taylor expansion: f(t+dt) ≈ f(t) + f'(t)dt + 0.5f''(t)dt^2
     */
    @Override
    public double predictAngle(double d, double vr, double accel, double dt) {
        double current = calculateAngle(d, vr);
        
        // First order change (Chain rule via Jacobian)
        double dAdt = (getAngleDerivativeWrtDistance(d, vr) * -vr) + 
                      (getAngleDerivativeWrtRadialVelocity(d, vr) * accel);
        
        // Second order change (High precision curvature compensation via Hessian)
        double d2Adt2 = (getAngleSecondDerivativeWrtDistance(d, vr) * vr * vr) + 
                        (getAngleMixedDerivative(d, vr) * -vr * accel);

        return current + (dAdt * dt) + (0.5 * d2Adt2 * dt * dt);
    }
}