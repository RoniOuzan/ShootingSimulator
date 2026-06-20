package com.shooting_simulator.simulation.obstacles;

import com.shooting_simulator.util.math.geometry.Translation2d;

public abstract class Obstacle {
    private final String id;
    private final String name;

    protected Obstacle(String id, String name) {
        this.id = id;
        this.name = name;
    }

    /**
     * Checks if the line segment between the previous and current position
     * intersects the obstacle's volume.
     */
    public abstract boolean isColliding(Translation2d prev, Translation2d next);
}
