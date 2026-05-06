export type TargetMode = "VERTICAL" | "HORIZONTAL";

export interface Translation2d {
  x: number;
  y: number;
}

export interface AerodynamicParams {
  mass: number;
  diameter: number;
  dragCoeff: number;
  spinRPSPerMS: number;
  magnusCoeff: number;
}

export interface HardwareLimits {
  minAngle: number;
  maxAngle: number;
  minVel: number;
  maxVel: number;
  estimatedAngleError: number;
  estimatedVelocityError: number;
}

export interface TargetParams {
  targetY: number;
  tolX: number;
  tolY: number;
  minHitAngle: number;
  maxHitAngle: number;
}

export interface OriginParams {
  initialX: number;
  initialY: number;
  radialVelocity: number;
}

export interface SharedConfig {
  targetMode: TargetMode;
  origin: OriginParams;
  target: TargetParams;
  aerodynamics: AerodynamicParams;
  hardware: HardwareLimits;
}

export interface Sample {
  position: Translation2d;
  velocity: Translation2d;
}

export interface Trajectory {
  samples: Sample[];
}

export interface SimulationResults {
  trajectories: Trajectory[];
  bestTrajectory: Trajectory | null;
  bestInfo: { angle: number; velocity: number } | null;
  robustnessData: any[];
  costData: any[];
}
