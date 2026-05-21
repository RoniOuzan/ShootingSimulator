package com.shooting_simulator.simulation.obstacles;

import com.shooting_simulator.util.math.geometry.Translation2d;
import java.util.List;

public class PolygonObstacle extends Obstacle {
    private List<Translation2d> vertices;

    // We use Double objects instead of primitives so they default to 'null' when Gson creates them.
    // The 'transient' keyword tells Gson to ignore these fields when serializing/deserializing.
    private transient Double minX, maxX, minY, maxY;

    public PolygonObstacle(String id, String name, List<Translation2d> vertices) {
        super(id, name);
        this.vertices = vertices;
        ensureBounds();
    }

    /**
     * Lazy-Initialization: Calculates bounds if they don't exist yet.
     * This saves us from Gson's constructor bypassing.
     */
    private void ensureBounds() {
        if (minX != null) return; // Already calculated

        minX = Double.MAX_VALUE;
        maxX = -Double.MAX_VALUE;
        minY = Double.MAX_VALUE;
        maxY = -Double.MAX_VALUE;

        if (vertices != null) {
            for (Translation2d v : vertices) {
                if (v.getX() < this.minX) this.minX = v.getX();
                if (v.getX() > this.maxX) this.maxX = v.getX();
                if (v.getY() < this.minY) this.minY = v.getY();
                if (v.getY() > this.maxY) this.maxY = v.getY();
            }
        }
    }

    @Override
    public boolean isColliding(Translation2d start, Translation2d end) {
        if (vertices == null || vertices.size() < 3) return false; // Invalid polygon shape

        ensureBounds(); // Ensure our fast-fail box is calculated

        // 1. Fast-Fail Bounding Box
        double segMinX = Math.min(start.getX(), end.getX());
        double segMaxX = Math.max(start.getX(), end.getX());
        double segMinY = Math.min(start.getY(), end.getY());
        double segMaxY = Math.max(start.getY(), end.getY());

        if (segMaxX < minX || segMinX > maxX || segMaxY < minY || segMinY > maxY) {
            return false;
        }

        // 2. Check if the trajectory segment crosses any edge of the polygon
        int n = vertices.size();
        for (int i = 0, j = n - 1; i < n; j = i++) {
            Translation2d v1 = vertices.get(j);
            Translation2d v2 = vertices.get(i);

            if (segmentsIntersect(start.getX(), start.getY(), end.getX(), end.getY(),
                    v1.getX(), v1.getY(), v2.getX(), v2.getY())) {
                return true;
            }
        }

        // 3. Edge Case: Dropped straight into the polygon without crossing walls this tick.
        return isPointInside(start.getX(), start.getY());
    }

    private boolean segmentsIntersect(double p0x, double p0y, double p1x, double p1y,
                                      double p2x, double p2y, double p3x, double p3y) {
        double s1x = p1x - p0x;
        double s1y = p1y - p0y;
        double s2x = p3x - p2x;
        double s2y = p3y - p2y;

        double denominator = (-s2x * s1y + s1x * s2y);
        if (denominator == 0) return false; // Parallel

        double s = (-s1y * (p0x - p2x) + s1x * (p0y - p2y)) / denominator;
        double t = ( s2x * (p0y - p2y) - s2y * (p0x - p2x)) / denominator;

        return s >= 0 && s <= 1 && t >= 0 && t <= 1;
    }

    private boolean isPointInside(double px, double py) {
        boolean isInside = false;
        int n = vertices.size();
        for (int i = 0, j = n - 1; i < n; j = i++) {
            Translation2d vi = vertices.get(i);
            Translation2d vj = vertices.get(j);

            boolean intersect = ((vi.getY() > py) != (vj.getY() > py)) &&
                    (px < (vj.getX() - vi.getX()) * (py - vi.getY()) / (vj.getY() - vi.getY()) + vi.getX());
            if (intersect) isInside = !isInside;
        }
        return isInside;
    }
}