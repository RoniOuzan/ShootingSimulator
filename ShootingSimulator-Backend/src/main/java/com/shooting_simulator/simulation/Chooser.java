package com.shooting_simulator.simulation;

import com.shooting_simulator.simulation.obstacles.Obstacle;
import com.shooting_simulator.simulation.records.CostWeights;
import com.shooting_simulator.simulation.records.PhysicalValues;
import com.shooting_simulator.simulation.records.TargetConfig;
import com.shooting_simulator.simulation.resolution.Resolution;

import java.util.List;

public abstract class Chooser {

    protected final TargetConfig target;
    protected final PhysicalValues physicalValues;
    protected final CostWeights costWeights;
    protected final List<Obstacle> obstacles;

    protected final Resolution resolution;

    protected Chooser(TargetConfig target, PhysicalValues physicalValues, CostWeights costWeights, List<Obstacle> obstacles, Resolution resolution) {
        this.target = target;
        this.physicalValues = physicalValues;
        this.costWeights = costWeights;
        this.obstacles = obstacles;
        this.resolution = resolution;
    }

    protected double goldenSectionSearch(double min, double max, boolean isFlat) {
        double phi = (Math.sqrt(5) - 1) / 2;
        double a = min;
        double b = max;

        double x1 = b - phi * (b - a);
        double x2 = a + phi * (b - a);

        double bestAngle = (a + b) / 2.0;
        double bestCost = Double.MAX_VALUE;

        while (Math.abs(b - a) > this.resolution.getAngle()) {
            double cost1 = getCostAtAngle(x1, isFlat);
            double cost2 = getCostAtAngle(x2, isFlat);

            if (cost1 < bestCost) {
                bestCost = cost1;
                bestAngle = x1;
            }

            if (cost2 < bestCost) {
                bestCost = cost2;
                bestAngle = x2;
            }

            if (cost1 < cost2) {
                b = x2;
                x2 = x1;
                x1 = b - phi * (b - a);
            } else {
                a = x1;
                x1 = x2;
                x2 = a + phi * (b - a);
            }
        }

        return bestAngle;
    }

    // Subclasses define how cost is calculated
    protected abstract double getCostAtAngle(double angle, boolean isFlat);

    public abstract Trajectory getBestTrajectory();
}