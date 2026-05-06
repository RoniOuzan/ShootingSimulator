import MultivariateLinearRegression from "ml-regression-multivariate-linear";
import { useMemo, useState } from "react";

export interface DataPoint {
  distance: number;
  radialVelocity: number;
  bestAngle: number;
  bestExitVelocity: number;
}

export interface DatasetState {
  normal: DataPoint[];
  min: DataPoint[];
  max: DataPoint[];
}

export interface ModelState {
  angleModel: MultivariateLinearRegression,
  velocityModel:  MultivariateLinearRegression,
  degree: number,
}

interface Props {
  models: {
    normal: ModelState | null;
    min: ModelState | null;
    max: ModelState | null;
  };
  hardware: { minAngle: number; maxAngle: number };
}

// Helper to expand [d, vr] into [d, vr, d^2, d*vr, vr^2, d^3...]
export const getPolynomialFeatures = (d: number, vr: number, degree: number) => {
  const features: number[] = [];
  const names: { pD: number; pVR: number }[] = [];

  // We explicitly add the intercept (1.0) as the first feature 
  // to ensure the math always lines up perfectly with the weights array.
  features.push(1.0);
  names.push({ pD: 0, pVR: 0 });

  for (let i = 1; i <= degree; i++) {
    for (let j = 0; j <= i; j++) {
      const k = i - j;
      features.push(Math.pow(d, k) * Math.pow(vr, j));
      names.push({ pD: k, pVR: j });
    }
  }
  return { features, names };
};

export default function CodeExporter({ models, hardware }: Props) {
  if (!models) return null;

  const [copied, setCopied] = useState(false);

  const generateEquation = (model: MultivariateLinearRegression | null, degree: number) => {
    if (!model) return "0.0";
    
    // Use the specific degree for this model to get the feature names
    const { names } = getPolynomialFeatures(1, 1, degree);
    const weights = model.weights;

    let equation = "";
    for (let i = 0; i < weights.length; i++) {
      const coef = weights[i][0];
      if (Math.abs(coef) < 1e-9) continue;
      
      const { pD, pVR } = names[i];
      let term = `(${coef.toFixed(10)}`;
      for (let j = 0; j < pD; j++) term += " * d";
      for (let j = 0; j < pVR; j++) term += " * vr";
      term += ")";
      equation += (i === 0) ? term : ` + \n           ${term}`;
    }
    return equation;
  };

  const javaCode = useMemo(() => {
    return `package frc.robot.util;

    public class ShooterBallistics {

        // --- Angle Calculations ---
        private static double angleNormal(double d, double vr) {
            return ${generateEquation(models.normal?.angleModel ?? null, models.normal?.degree || 3)};
        }
        
        private static double angleMin(double d, double vr) {
            return ${generateEquation(models.min?.angleModel ?? null, models.min?.degree || 1)};
        }
        
        private static double angleMax(double d, double vr) {
            return ${generateEquation(models.max?.angleModel ?? null, models.max?.degree || 1)};
        }

        public static double calculateAngle(double d, double vr) {
            double normal = angleNormal(d, vr);
            if (normal <= ${hardware.minAngle}) return angleMin(d, vr);
            if (normal >= ${hardware.maxAngle}) return angleMax(d, vr);
            return normal;
        }

        // --- Velocity Calculations ---
        private static double velocityNormal(double d, double vr) {
            return ${generateEquation(models.normal?.velocityModel ?? null, models.normal?.degree || 3)};
        }
        
        private static double velocityMin(double d, double vr) {
            return ${generateEquation(models.min?.velocityModel ?? null, models.min?.degree || 1)};
        }
        
        private static double velocityMax(double d, double vr) {
            return ${generateEquation(models.max?.velocityModel ?? null, models.max?.degree || 1)};
        }

        public static double calculateVelocity(double d, double vr) {
            double normal = angleNormal(d, vr); // Determine regime based on angle
            if (normal <= ${hardware.minAngle}) return velocityMin(d, vr);
            if (normal >= ${hardware.maxAngle}) return velocityMax(d, vr);
            return velocityNormal(d, vr);
        }
    }`;
  }, [models, hardware]);

  const handleCopy = () => {
    navigator.clipboard.writeText(javaCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="tab-config-card" style={{ marginTop: "20px", borderLeft: "4px solid #00ccff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <h3 style={{ color: "#00ccff", margin: 0 }}>Generated FRC Constants</h3>
        <button 
          onClick={handleCopy} 
          className="calculate-btn"
          style={{ padding: "6px 12px", background: copied ? "#00ccff" : "#333", color: copied ? "#111" : "#fff", border: "none" }}
        >
          {copied ? "Copied!" : "Copy to Clipboard"}
        </button>
      </div>
      
      <pre style={{
        background: "#0a0a0c",
        padding: "15px",
        borderRadius: "8px",
        border: "1px solid #2a2a35",
        color: "#d4d4d4",
        fontSize: "0.85rem",
        overflowX: "auto"
      }}>
        <code>{javaCode}</code>
      </pre>
    </div>
  );
}