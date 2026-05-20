package com.shooting_simulator.simulation.obstacles;

import com.shooting_simulator.util.math.geometry.Translation2d;

public interface Obstacle {
    /**
     * Checks if the line segment between the previous and current position
     * intersects the obstacle's volume.
     */
    boolean isColliding(Translation2d prev, Translation2d next);
}
