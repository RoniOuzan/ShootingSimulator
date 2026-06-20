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
  derivative: boolean;
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
    derivative: true,
  },
  velocity: {
    id: "velocity",
    matrixKey: "velocityMatrix",
    name: "Optimal Velocity",
    unit: "m/s",
    isBoundaryAxis: false,
    degrees: { normal: 5, min: 4, max: 4 },
    thresholds: { excellent: 0.05, acceptable: 0.2 },
    derivative: true,
  },
  
  flightTime: {
    id: "flightTime",
    matrixKey: "flightTimeMatrix",
    name: "Flight Time",
    unit: "s",
    isBoundaryAxis: false,
    degrees: { normal: 5, min: 4, max: 3 },
    thresholds: { excellent: 0.05, acceptable: 0.2 },
    derivative: false,
  },
  
  toleranceVelPositive: {
    id: "toleranceVelPositive",
    matrixKey: "toleranceVelPositiveMatrix",
    name: "Pos Velocity Tolerance",
    unit: "m/s",
    isBoundaryAxis: false,
    degrees: { normal: 5, min: 3, max: 5 },
    thresholds: { excellent: 0.2, acceptable: 0.5 },
    derivative: false,
  },
  toleranceVelNegative: {
    id: "toleranceVelNegative",
    matrixKey: "toleranceVelNegativeMatrix",
    name: "Neg Velocity Tolerance",
    unit: "m/s",
    isBoundaryAxis: false,
    degrees: { normal: 5, min: 3, max: 5 },
    thresholds: { excellent: 0.2, acceptable: 0.5 },
    derivative: false,
  },
  toleranceAnglePositive: {
    id: "toleranceAnglePositive",
    matrixKey: "toleranceAnglePositiveMatrix",
    name: "Pos Angle Tolerance",
    unit: "°",
    isBoundaryAxis: false,
    degrees: { normal: 5, min: 3, max: 4 }, 
    thresholds: { excellent: 0.3, acceptable: 0.8 },
    derivative: false,
  },
  toleranceAngleNegative: {
    id: "toleranceAngleNegative",
    matrixKey: "toleranceAngleNegativeMatrix",
    name: "Neg Angle Tolerance",
    unit: "°",
    isBoundaryAxis: false,
    degrees: { normal: 5, min: 3, max: 4 },
    thresholds: { excellent: 0.3, acceptable: 0.8 },
    derivative: false,
  },

  toleranceEllipseAngle: {
    id: "toleranceEllipseAngle",
    matrixKey: "toleranceEllipseAngleMatrix",
    name: "Ellipse Angle Tolerance",
    unit: "°",
    isBoundaryAxis: false,
    degrees: { normal: 5, min: 5, max: 5 },
    thresholds: { excellent: 0.3, acceptable: 1 },
    derivative: false,
  },
};

export const VAR_KEYS = Object.keys(TARGET_VARIABLES);

export function getQualityColor(variableId: string, maxErr: number) {
  const t = TARGET_VARIABLES[variableId].thresholds;
  if (maxErr <= t.excellent) return "#00e676";
  if (maxErr <= t.acceptable) return "#ffd740";
  return "#ff5252";
}