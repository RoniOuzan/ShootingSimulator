package com.shooting_simulator;

/**
 * Auto-generated Ballistic Controller with Hessian support for curvature compensation.
 */
public final class ShooterBallistics {

    // ── Hardware Constraints ─────────────────────────────────────────────────
    public static final double MIN_SAFE_ANGLE = 50.00;
    public static final double MAX_SAFE_ANGLE = 90.00;

    private ShooterBallistics() {}

    // ── Angle Prediction ─────────────────────────────────────────────────────

    public static double calculateAngle(double d, double vr) {
        double normal = (87.8474138772) -
                (9.7151672985 * d) +
                (8.8848467015 * vr) +
                (1.5711575219 * d * d) -
                (0.9838412683 * d * vr) +
                (0.1843374536 * vr * vr) -
                (0.1837593159 * d * d * d) +
                (0.1076645489 * d * d * vr) -
                (0.0076079458 * d * vr * vr) -
                (0.0210275410 * vr * vr * vr) +
                (0.0094615239 * d * d * d * d) -
                (0.0074600296 * d * d * d * vr) +
                (0.0034330612 * d * d * vr * vr) -
                (0.0005405463 * d * vr * vr * vr) +
                (0.0005965838 * vr * vr * vr * vr);
        if (normal <= MIN_SAFE_ANGLE) return (50.0181395363) -
                (0.0014360052 * d) +
                (0.0034414187 * vr);
        if (normal >= MAX_SAFE_ANGLE) return (89.9967791952) -
                (0.0034646565 * d) +
                (0.0039487631 * vr);
        return normal;
    }

    /** 1st Derivative: dA/dd */
    public static double getAngledD(double d, double vr) {
        return  -
                (9.7151672985) +
                (3.1423150438 * d) -
                (0.9838412683 * vr) -
                (0.5512779478 * d * d) +
                (0.2153290977 * d * vr) -
                (0.0076079458 * vr * vr) +
                (0.0378460956 * d * d * d) -
                (0.0223800887 * d * d * vr) +
                (0.0068661225 * d * vr * vr) -
                (0.0005405463 * vr * vr * vr);
    }

    /** 1st Derivative: dA/dvr */
    public static double getAngleDVR(double d, double vr) {
        return (8.8848467015) -
                (0.9838412683 * d) +
                (0.3686749072 * vr) +
                (0.1076645489 * d * d) -
                (0.0152158915 * d * vr) -
                (0.0630826230 * vr * vr) -
                (0.0074600296 * d * d * d) +
                (0.0068661225 * d * d * vr) -
                (0.0016216389 * d * vr * vr) +
                (0.0023863353 * vr * vr * vr);
    }

    /** 2nd Derivative: d^2A/dd^2 */
    public static double getAngledD2(double d, double vr) {
        return (3.1423150438) -
                (1.1025558956 * d) +
                (0.2153290977 * vr) +
                (0.1135382869 * d * d) -
                (0.0447601775 * d * vr) +
                (0.0068661225 * vr * vr);
    }

    /** Mixed Partial Derivative: d^2A/d(d)d(vr) */
    public static double getAngledDdVR(double d, double vr) {
        return  -
                (0.9838412683) +
                (0.2153290977 * d) -
                (0.0152158915 * vr) -
                (0.0223800887 * d * d) +
                (0.0137322450 * d * vr) -
                (0.0016216389 * vr * vr);
    }

    // ── Velocity Prediction ──────────────────────────────────────────────────

    public static double calculateVelocity(double d, double vr) {
        double angle = calculateAngle(d, vr);
        if (angle <= MIN_SAFE_ANGLE) return (4.9002062055) +
                (0.9443225468 * d) -
                (0.3719964035 * vr) -
                (0.0259580710 * d * d) -
                (0.0317453920 * d * vr) +
                (0.0701342998 * vr * vr);
        if (angle >= MAX_SAFE_ANGLE) return (6.9595626607) +
                (2.3693733473 * d) -
                (2.0178788098 * vr) +
                (0.3809033101 * d * d) -
                (1.0442164461 * d * vr) +
                (0.6083415475 * vr * vr);
        return (6.3410647595) +
                (0.6127928210 * d) -
                (0.0893779471 * vr) -
                (0.0002952716 * d * d) -
                (0.1219997759 * d * vr) +
                (0.0616799089 * vr * vr) -
                (0.0014682969 * d * d * d) +
                (0.0149144797 * d * d * vr) -
                (0.0074876586 * d * vr * vr) +
                (0.0005490023 * vr * vr * vr) +
                (0.0001284539 * d * d * d * d) -
                (0.0009881933 * d * d * d * vr) +
                (0.0007142358 * d * d * vr * vr) -
                (0.0001683118 * d * vr * vr * vr) -
                (0.0000359124 * vr * vr * vr * vr);
    }

    /** 1st Derivative: dV/dd */
    public static double getVelocitydD(double d, double vr) {
        return (0.6127928210) -
                (0.0005905433 * d) -
                (0.1219997759 * vr) -
                (0.0044048907 * d * d) +
                (0.0298289595 * d * vr) -
                (0.0074876586 * vr * vr) +
                (0.0005138155 * d * d * d) -
                (0.0029645800 * d * d * vr) +
                (0.0014284715 * d * vr * vr) -
                (0.0001683118 * vr * vr * vr);
    }

    /** 2nd Derivative: d^2V/dd^2 */
    public static double getVelocitydD2(double d, double vr) {
        return  -
                (0.0005905433) -
                (0.0088097813 * d) +
                (0.0298289595 * vr) +
                (0.0015414466 * d * d) -
                (0.0059291601 * d * vr) +
                (0.0014284715 * vr * vr);
    }

    // ── Advanced Control ─────────────────────────────────────────────────────

    /**
     * Calculates the estimated optimal angle adjusting for latency and acceleration.
     * Uses a Taylor expansion: f(t+dt) ≈ f(t) + f'(t)dt + 0.5f''(t)dt^2
     */
    public static double predictAngle(double d, double vr, double accel, double dt) {
        double current = calculateAngle(d, vr);

        // First order change (Chain rule)
        double dAdt = (getAngledD(d, vr) * -vr) + (getAngleDVR(d, vr) * accel);

        // Second order change (High precision curvature compensation)
        double d2Adt2 = (getAngledD2(d, vr) * vr * vr) + (getAngledDdVR(d, vr) * -vr * accel);

        return current + (dAdt * dt) + (0.5 * d2Adt2 * dt * dt);
    }
}