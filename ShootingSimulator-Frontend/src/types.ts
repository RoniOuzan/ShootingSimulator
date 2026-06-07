export type TargetAxis = "VERTICAL" | "HORIZONTAL";

export interface Translation2d {
  x: number;
  y: number;
}

export interface AerodynamicParams {
  mass: number;
  radius: number;
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
  center: Translation2d;
  minHitAngle: number;
  maxHitAngle: number;
  axis: TargetAxis;
  radius: number;
}

export interface OriginParams {
  initialY: number;
  radialVelocity: number;
}

export interface SharedConfig {
  origin: OriginParams;
  target: TargetParams;
  aerodynamics: AerodynamicParams;
  hardware: HardwareLimits;
  cost: CostConfig;
  obstacles: ObstacleConfig[];
  resolutionMode: ResolutionMode;
}

export type CostPreset =
  | "ROBUST"
  | "SLOW_SHOT"
  | "FAST_ARRIVAL"
  | "SWISH"
  | "BALANCED"
  | "CUSTOM";

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
  initialShootingVelocity: Translation2d;
  tolerance: Tolerance | null;
}

export interface TrajectoryCouple {
  closeTrajectory: Trajectory;
  farTrajectory: Trajectory;
  optimalTrajectory: Trajectory;
}

export interface Tolerance {
  velocityPositive: number;
  velocityNegative: number;
  anglePositive: number;
  angleNegative: number;
  ellipseAngle: number;
}

export interface SimulationResults {
  trajectories: Trajectory[];
  bestTrajectory: Trajectory | null;
  bestInfo: { angle: number; velocity: number } | null;
  robustnessData: any[];
  costData: any[];
}

export interface OptimalResults {
  trajectories: TrajectoryCouple[];
  bestTrajectory: Trajectory | null;
  robustnessData: any[];
  costData: Translation2d[];
  velocityGapData: Translation2d[];
  gapDerivativeData: Translation2d[];
}

export interface Translation2d {
  x: number;
  y: number;
}

export type ObstacleConfig =
  | {
      type: "CIRCLE";
      id: string;
      name: string;
      center: Translation2d;
      radius: number;
    }
  | { type: "POLYGON"; id: string; name: string; vertices: Translation2d[] };

export const parseVelocityVector = (
  vector: Translation2d | null | undefined,
) => {
  if (!vector) return { angle: 0, velocity: 0 };
  const velocity = Math.hypot(vector.x, vector.y);
  const angle = Math.atan2(vector.y, vector.x) * (180 / Math.PI);
  return { angle, velocity };
};

export type SimulationType = "CENTER" | "OPTIMAL";

export type ResolutionMode = "FAST" | "BALANCED" | "ACCURATE" | "ORBIT";
