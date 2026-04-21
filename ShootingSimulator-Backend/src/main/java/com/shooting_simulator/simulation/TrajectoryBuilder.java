package com.shooting_simulator.simulation;

import com.shooting_simulator.Constants;
import com.shooting_simulator.util.math.MathUtil;
import com.shooting_simulator.util.math.geometry.Rotation2d;
import com.shooting_simulator.util.math.geometry.Translation2d;
import lombok.Getter;
import lombok.SneakyThrows;

import java.util.ArrayList;
import java.util.List;

@Getter
public class TrajectoryBuilder {
    public static final double PERIOD = 0.005;

    private final Translation2d initialPosition;
    private final double radialVelocity;
    private final Translation2d target;
    private final Translation2d targetTolerance;
    private final double minHitAngle;
    private final double maxHitAngle;

    private final PhysicalValues physicalValues;

    public TrajectoryBuilder(Translation2d initialPosition, double radialVelocity, Translation2d target, Translation2d targetTolerance, double minHitAngle, double maxHitAngle, PhysicalValues physicalValues) {
        this.initialPosition = initialPosition;
        this.radialVelocity = radialVelocity;
        this.target = target;
        this.targetTolerance = targetTolerance;
        this.minHitAngle = minHitAngle;
        this.maxHitAngle = maxHitAngle;
        this.physicalValues = physicalValues;
    }

    public boolean isInsideTarget(Sample sample) {
        boolean withinXBounds = Math.abs(sample.getPosition().getX() - this.target.getX()) <= this.targetTolerance.getX();
        boolean withinYBounds = Math.abs(sample.getPosition().getY() - this.target.getY()) <= this.targetTolerance.getY();
        return withinXBounds && withinYBounds && isInHitAngleRange(sample.getVelocity().getAngle());
    }

    public Trajectory simulateTrajectory(double exitVelocity, Rotation2d angle) {
        if (angle.getDegrees() < this.physicalValues.minAngle || angle.getDegrees() > this.physicalValues.maxAngle) {
            throw new RuntimeException("Angle " + angle.getDegrees() + " is not possible to shoot in this shooter!");
        }

        List<Sample> samples = new ArrayList<>();

        final Translation2d initialShootingVelocity = new Translation2d(exitVelocity, angle).plus(new Translation2d(this.radialVelocity, 0));

        Translation2d position = this.initialPosition;
        Translation2d velocity = initialShootingVelocity;
        samples.add(new Sample(position, velocity));

        while (shouldCalculateTrajectory(position, velocity)) {
            Translation2d acceleration = calculateAcceleration(velocity);

            // Calculate next position using exact kinematics (matches your quadratic solver)
            Translation2d nextPosition = position
                    .plus(velocity.times(PERIOD))
                    .plus(acceleration.times(0.5 * PERIOD * PERIOD));

            Translation2d nextVelocity = velocity.plus(acceleration.times(PERIOD));

            // Check for crossing
            if (position.getY() >= this.target.getY() && nextPosition.getY() < this.target.getY() && velocity.getY() < 0) {
                // Add the perfect sample and STOP
                samples.add(calculateLastSample(position, velocity, acceleration));
                break;
            }

            // Standard update if no crossing
            position = nextPosition;
            velocity = nextVelocity;
            samples.add(new Sample(position, velocity));
        }

        return new Trajectory(samples, initialShootingVelocity);
    }

    private boolean shouldCalculateTrajectory(Translation2d position, Translation2d velocity) {
        // Simulation ends if the projectile hits the floor
        if (position.getY() < 0) {
            return false;
        }

        // Simulation ends if it is falling AND has dropped completely below the bottom edge of the target
        if (velocity.getY() < 0 && position.getY() < this.target.getY() - this.targetTolerance.getY()) {
            return false;
        }
        // If none of the miss conditions are met, keep simulating
        return true;
    }

    private Sample calculateLastSample(Translation2d position, Translation2d velocity, Translation2d acceleration) {
        double deltaY = this.target.getY() - position.getY();

        // Solve: 0.5*a*t^2 + v*t - deltaY = 0
        double[] roots = MathUtil.quadraticSolver(0.5 * acceleration.getY(), velocity.getY(), -deltaY);

        double exactT = PERIOD; // fallback
        if (roots.length == 1) {
            exactT = roots[0];
        } else if (roots.length == 2) {
            // Pick the smallest positive root
            double t1 = roots[0], t2 = roots[1];
            if (t1 > 0 && t2 > 0) exactT = Math.min(t1, t2);
            else exactT = Math.max(t1, t2);
        }

        // Recalculate exactly AT the crossing time
        Translation2d exactPosition = position
                .plus(velocity.times(exactT))
                .plus(acceleration.times(0.5 * exactT * exactT));

        Translation2d exactVelocity = velocity.plus(acceleration.times(exactT));

        return new Sample(exactPosition, exactVelocity);
    }

    private boolean isInHitAngleRange(Rotation2d angle) {
        return angle.getDegrees() >= this.minHitAngle && angle.getDegrees() <= this.maxHitAngle;
    }

    private Translation2d calculateAcceleration(Translation2d velocity) {
        Translation2d totalAcceleration = new Translation2d(0, Constants.GRAVITY); // gravity
        double vMag = velocity.getNorm();

        if (vMag > 0.001) { // Prevent division by zero
            double radius = this.physicalValues.diameter;
            double area = Math.PI * Math.pow(radius, 2);

            Translation2d dragAcceleration = calculateDrag(velocity, area);
            Translation2d magnusAcceleration = calculateMagnus(velocity, radius, area);

            totalAcceleration = totalAcceleration.plus(dragAcceleration).plus(magnusAcceleration);
        }

        return totalAcceleration;
    }

    private Translation2d calculateDrag(Translation2d velocity, double area) {
        double vMag = velocity.getNorm();

        // F_d = 0.5 * rho * v^2 * C_d * A
        double dragForce = 0.5 * Constants.AIR_DENSITY * (vMag * vMag) * this.physicalValues.dragCoeff * area;
        // a = F / m
        double dragAccMag = dragForce / this.physicalValues.mass;

        // Drag always opposes the velocity vector
        return velocity.div(vMag).times(-dragAccMag);
    }

    private Translation2d calculateMagnus(Translation2d velocity, double radius, double area) {
        double omega = this.getBallRPS(velocity.getNorm()) * (2 * Math.PI);

        // Calculate the Magnus scalar (v cancels out with the perpendicular vector normalizer)
        double magnusScalar = (0.5 * Constants.AIR_DENSITY * this.physicalValues.magnusCoeff * radius * omega * area) / this.physicalValues.mass;

        // The cross product of spin and velocity results in a perpendicular vector: (-Vy, Vx)
        return new Translation2d(-velocity.getY() * magnusScalar, velocity.getX() * magnusScalar);
    }

    private double getBallRPS(double velocity) {
        return this.physicalValues.spinRPSPerMS * velocity;
    }
}
