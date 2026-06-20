package com.shooting_simulator.simulation.physics;

public enum ProjectileShape {

    BALL {
        @Override
        public double calculateMagnusForce(double v, double omega, double r, double innerRadius, double area, double rho) {
            // 2D omega = backspin/topspin. We CAN use omega here!
            // Calculate a basic spin parameter: S = (omega * r) / v
            double spinParameter = (v > 0.1) ? Math.abs((omega * r) / v) : 0;

            // Cl scales with spin. Cap it to prevent infinite lift at crazy RPMs.
            double cl = Math.min(0.3, 0.2 * spinParameter);

            // Note: If omega is negative (topspin), the vector math in your model
            // naturally handles pushing it downward.
            return cl * 0.5 * rho * (v * v) * area;
        }
    },

    RING {
        @Override
        public double calculateMagnusForce(double v, double omega, double r, double innerRadius, double area, double rho) {
            if (r <= innerRadius) return 0.0;
            double solidArea = Math.PI * ((r * r) - (innerRadius * innerRadius));

            // IGNORE 2D OMEGA. A ring in a 2D side-view shouldn't tumble.
            // We assume it's flying flat with invisible 3D stabilizing spin.
            double staticCl = 0.05;
            return staticCl * 0.5 * rho * (v * v) * solidArea;
        }
    },

    FRISBEE {
        @Override
        public double calculateMagnusForce(double v, double omega, double r, double innerRadius, double area, double rho) {
            // IGNORE 2D OMEGA. Assume it's flying flat.
            // Just apply standard Bernoulli lift.
            double staticCl = 0.15;
            return staticCl * 0.5 * rho * (v * v) * area;
        }
    },

    FOOTBALL {
        @Override
        public double calculateMagnusForce(double v, double omega, double r, double innerRadius, double area, double rho) {
            // IGNORE 2D OMEGA. Assume a perfect spiral.
            double staticCl = 0.12;
            return staticCl * 0.5 * rho * (v * v) * area;
        }
    },

    DISK {
        @Override
        public double calculateMagnusForce(double v, double omega, double r, double innerRadius, double area, double rho) {
            return 0.0;
        }
    };

    public abstract double calculateMagnusForce(double v, double omega, double r, double innerRadius, double area, double rho);
}