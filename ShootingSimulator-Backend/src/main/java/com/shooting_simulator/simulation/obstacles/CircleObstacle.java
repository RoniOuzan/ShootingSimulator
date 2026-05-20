package com.shooting_simulator.simulation.obstacles;

import com.shooting_simulator.util.math.geometry.Translation2d;

public class CircleObstacle extends Obstacle {
    private final Translation2d center;
    private final double radiusSq;

    public CircleObstacle(Translation2d center, double radius) {
        this.center = center;
        this.radiusSq = radius * radius; // Pre-calculate square
    }

    @Override
    public boolean isColliding(Translation2d start, Translation2d end) {
        // Set up the quadratic equation for a line-to-circle intersection
        double dx = end.getX() - start.getX();
        double dy = end.getY() - start.getY();
        double fx = start.getX() - center.getX();
        double fy = start.getY() - center.getY();

        double a = dx * dx + dy * dy;
        double b = 2 * (fx * dx + fy * dy);
        double c = (fx * fx + fy * fy) - radiusSq;

        // Edge case: The projectile hasn't moved (a == 0)
        if (a == 0) {
            return c <= 0; // Check if the static point is inside
        }

        // Solve the discriminant to see if the line hits the circle
        double discriminant = b * b - 4 * a * c;
        if (discriminant < 0) {
            return false; // Trajectory completely missed
        }

        discriminant = Math.sqrt(discriminant);
        double t1 = (-b - discriminant) / (2 * a);
        double t2 = (-b + discriminant) / (2 * a);

        // Check if either intersection happened during THIS tick (t between 0 and 1)
        if (t1 >= 0 && t1 <= 1) return true;
        if (t2 >= 0 && t2 <= 1) return true;

        // Final Edge Case: The trajectory segment started and ended completely 
        // inside the circle without crossing the boundary this tick.
        return c <= 0; 
    }
}