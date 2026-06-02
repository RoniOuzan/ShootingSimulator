export interface TargetVariable {
  id: string;              // e.g., 'angle', 'velocity'
  matrixKey: string;       // Key expected in surfaceData (e.g., 'angleMatrix')
  name: string;            // Display name
  unit: string;            // Unit for charts
  isBoundaryAxis?: boolean; // Does this variable dictate the Min/Max bounds? (e.g., the pivot angle)
  degrees: {
    normal: number | null;
    min: number | null;
    max: number | null;
  };
  thresholds: {
    excellent: number;
    acceptable: number;
  };
}

export const TARGET_VARIABLES: Record<string, TargetVariable> = {
  angle: {
    id: "angle",
    matrixKey: "angleMatrix",
    name: "Optimal Angle",
    unit: "°",
    isBoundaryAxis: true,
    degrees: { normal: 5, min: null, max: null },
    thresholds: { excellent: 0.15, acceptable: 0.5 },
  },
  velocity: {
    id: "velocity",
    matrixKey: "velocityMatrix",
    name: "Optimal Velocity",
    unit: "m/s",
    isBoundaryAxis: false,
    degrees: { normal: 5, min: 4, max: 3 },
    thresholds: { excellent: 0.05, acceptable: 0.2 },
  },
  
  velTolPos: {
    id: "velTolPos",
    matrixKey: "velTolPosMatrix",
    name: "Pos Velocity Tolerance",
    unit: "m/s",
    isBoundaryAxis: false,
    degrees: { normal: 5, min: 3, max: 3 },
    thresholds: { excellent: 0.05, acceptable: 0.2 },
  },
  velTolNeg: {
    id: "velTolNeg",
    matrixKey: "velTolNegMatrix",
    name: "Neg Velocity Tolerance",
    unit: "m/s",
    isBoundaryAxis: false,
    degrees: { normal: 5, min: 3, max: 3 },
    thresholds: { excellent: 0.05, acceptable: 0.2 },
  },
  angTolPos: {
    id: "angTolPos",
    matrixKey: "angTolPosMatrix",
    name: "Pos Angle Tolerance",
    unit: "°",
    isBoundaryAxis: false,
    degrees: { normal: 5, min: 3, max: 3 }, 
    thresholds: { excellent: 0.2, acceptable: 0.5 },
  },
  angTolNeg: {
    id: "angTolNeg",
    matrixKey: "angTolNegMatrix",
    name: "Neg Angle Tolerance",
    unit: "°",
    isBoundaryAxis: false,
    degrees: { normal: 5, min: 3, max: 3 },
    thresholds: { excellent: 0.2, acceptable: 0.5 },
  },
};

export const VAR_KEYS = Object.keys(TARGET_VARIABLES);

export function getQualityColor(variableId: string, maxErr: number) {
  const t = TARGET_VARIABLES[variableId].thresholds;
  if (maxErr <= t.excellent) return "#00e676";
  if (maxErr <= t.acceptable) return "#ffd740";
  return "#ff5252";
}