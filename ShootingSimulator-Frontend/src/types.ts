export type TargetAxis = "VERTICAL" | "HORIZONTAL";

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
  minHitAngle: number;
  maxHitAngle: number;
  targetAxis: TargetAxis;
}

export interface OriginParams {
  initialX: number;
  initialY: number;
  radialVelocity: number;
}

export interface SharedConfig {
  origin: OriginParams;
  target: TargetParams;
  aerodynamics: AerodynamicParams;
  hardware: HardwareLimits;
  cost: CostConfig;
}

export type CostPreset = "ROBUST" | "SLOW_SHOT" | "FAST_ARRIVAL" | "SWISH" | "REBUILT_MIXED" | "CUSTOM";

export interface CostConfig {
  preset: CostPreset;
  robustnessWeight: number;
  initialVelocityWeight: number;
  impactVelocityWeight: number;
  timeOfFlightWeight: number;
  entryAngleWeight: number;
  targetImpactAngle: number;
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

export interface Translation2d {
  x: number;
  y: number;
}

export function angle(vector: Translation2d | undefined): number {
  if (!vector) return 0;
  return (Math.atan2(vector.y, vector.x) * 180) / Math.PI;
}