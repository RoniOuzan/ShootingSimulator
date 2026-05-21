package com.shooting_simulator.simulation.obstacles;

import com.shooting_simulator.util.math.geometry.Translation2d;
import lombok.ToString;

@ToString
public class CircleObstacle extends Obstacle {
    private final Translation2d center;
    private final double radius;

    public CircleObstacle(String id, String name, Translation2d center, double radius) {
        super(id, name);
        this.center = center;
        this.radius = radius;
    }

    @Override
    public boolean isColliding(Translation2d start, Translation2d end) {
        double dx = end.getX() - start.getX();
        double dy = end.getY() - start.getY();

        // Length of the segment squared
        double lengthSq = (dx * dx) + (dy * dy);

        // Edge Case: Projectile hasn't moved at all
        if (lengthSq == 0.0) {
            double distSq = Math.pow(start.getX() - center.getX(), 2) +
                    Math.pow(start.getY() - center.getY(), 2);
            return distSq <= (radius * radius);
        }

        // Project the circle's center onto the line segment to find 't' (percentage along the line)
        // t = dotProduct(center - start, end - start) / lengthSq
        double t = ((center.getX() - start.getX()) * dx + (center.getY() - start.getY()) * dy) / lengthSq;

        // Clamp 't' between 0 and 1 so we only check the actual segment, not the infinite line
        t = Math.max(0, Math.min(1, t));

        // Find the exact closest point on the segment to the center of the circle
        double closestX = start.getX() + (t * dx);
        double closestY = start.getY() + (t * dy);

        // Calculate the distance from the closest point to the center
        double distSq = Math.pow(closestX - center.getX(), 2) +
                Math.pow(closestY - center.getY(), 2);

        // If the closest point on the line is within the radius, it's a collision!
        return distSq <= (radius * radius);
    }
}