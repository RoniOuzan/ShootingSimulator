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
  angleModel: MultivariateLinearRegression | null;
  velocityModel: MultivariateLinearRegression;
  angleDegree: number | null;
  velocityDegree: number;
}

interface Props {
  models: {
    normal: ModelState | null;
    min: ModelState | null;
    max: ModelState | null;
  };
  hardware: { minAngle: number; maxAngle: number };
  datasetCounts?: { normal: number; min: number; max: number };
}

// ── Polynomial feature expansion ─────────────────────────────────────────────
export const getPolynomialFeatures = (
  d: number,
  vr: number,
  degree: number,
) => {
  const features: number[] = [];
  const names: { pD: number; pVR: number }[] = [];

  // Intercept as explicit feature so weight indices always align
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

// ── Term builder helpers ──────────────────────────────────────────────────────
function buildTermString(
  coef: number,
  pD: number,
  pVR: number,
  isFirst: boolean,
): string {
  const abs = Math.abs(coef);
  const sign = coef < 0 ? " -\n           " : isFirst ? "" : " +\n           ";
  let term = `${sign}(${abs.toFixed(10)}`;
  for (let i = 0; i < pD; i++) term += " * d";
  for (let i = 0; i < pVR; i++) term += " * vr";
  term += ")";
  return term;
}

function generateEquation(
  model: MultivariateLinearRegression | null,
  degree: number | null,
): string {
  if (!model || degree === null) return "0.0";
  const { names } = getPolynomialFeatures(1, 1, degree);
  const weights = model.weights;

  const terms: string[] = [];
  for (let i = 0; i < weights.length; i++) {
    const coef = weights[i][0];
    if (Math.abs(coef) < 1e-9) continue;
    const { pD, pVR } = names[i];
    terms.push(buildTermString(coef, pD, pVR, terms.length === 0));
  }
  return terms.length > 0 ? terms.join("") : "0.0";
}

function termCount(model: MultivariateLinearRegression | null): number {
  if (!model) return 0;
  return model.weights.filter((w) => Math.abs(w[0]) >= 1e-9).length;
}

// ── Derivative Term Builder ──────────────────────────────────────────────────
function generateDerivativeEquation(
  model: MultivariateLinearRegression | null,
  degree: number | null,
  targetVar: 'd' | 'vr'
): string {
  if (!model || degree === null) return "0.0";
  const { names } = getPolynomialFeatures(1, 1, degree);
  const weights = model.weights;
  const terms: string[] = [];

  for (let i = 0; i < weights.length; i++) {
    const coef = weights[i][0];
    const { pD, pVR } = names[i];
    
    let derivativeCoef = 0;
    let newPD = pD;
    let newPVR = pVR;

    if (targetVar === 'd' && pD > 0) {
      derivativeCoef = coef * pD;
      newPD = pD - 1;
    } else if (targetVar === 'vr' && pVR > 0) {
      derivativeCoef = coef * pVR;
      newPVR = pVR - 1;
    }

    if (Math.abs(derivativeCoef) < 1e-9) continue;
    terms.push(buildTermString(derivativeCoef, newPD, newPVR, terms.length === 0));
  }
  return terms.length > 0 ? terms.join("") : "0.0";
}

function generateSecondDerivativeEquation(
  model: MultivariateLinearRegression | null,
  degree: number | null,
  var1: 'd' | 'vr',
  var2: 'd' | 'vr'
): string {
  if (!model || degree === null) return "0.0";
  const { names } = getPolynomialFeatures(1, 1, degree);
  const weights = model.weights;
  const terms: string[] = [];

  for (let i = 0; i < weights.length; i++) {
    const coef = weights[i][0];
    const { pD, pVR } = names[i];
    
    let derivativeCoef = coef;
    let currPD = pD;
    let currPVR = pVR;

    if (var1 === 'd') { if (currPD > 0) { derivativeCoef *= currPD; currPD--; } else continue; }
    else { if (currPVR > 0) { derivativeCoef *= currPVR; currPVR--; } else continue; }

    if (var2 === 'd') { if (currPD > 0) { derivativeCoef *= currPD; currPD--; } else continue; }
    else { if (currPVR > 0) { derivativeCoef *= currPVR; currPVR--; } else continue; }

    if (Math.abs(derivativeCoef) < 1e-9) continue;
    terms.push(buildTermString(derivativeCoef, currPD, currPVR, terms.length === 0));
  }
  return terms.length > 0 ? terms.join("") : "0.0";
}

function buildJavaCode(
  models: Props["models"],
  hardware: Props["hardware"],
): string {
  const hasData = !!models.normal;
  const nAd = models.normal?.angleDegree ?? 4;
  const nVd = models.normal?.velocityDegree ?? 4;
  
  // Extract degrees for min and max velocity regimes
  const minVd = models.min?.velocityDegree ?? 2;
  const maxVd = models.max?.velocityDegree ?? 2;

  const getEq = (m: any, d: number | null) => hasData ? generateEquation(m, d) : "0.0";
  const getD1 = (m: any, d: number | null, v: 'd' | 'vr') => hasData ? generateDerivativeEquation(m, d, v) : "0.0";
  const getD2 = (m: any, d: number | null, v1: 'd' | 'vr', v2: 'd' | 'vr') => hasData ? generateSecondDerivativeEquation(m, d, v1, v2) : "0.0";

  return `package frc.robot.util;

/**
 * Interface for interchangeable ballistics profiles.
 */
public interface ShooterProfile {
    double calculateAngle(double d, double vr);
    double getAngleDerivativeWrtDistance(double d, double vr);
    double getAngleDerivativeWrtRadialVelocity(double d, double vr);
    double getAngleSecondDerivativeWrtDistance(double d, double vr);
    double getAngleMixedDerivative(double d, double vr);
    
    double calculateVelocity(double d, double vr);
    double getVelocityDerivativeWrtDistance(double d, double vr);
    double getVelocitySecondDerivativeWrtDistance(double d, double vr);
    
    double predictAngle(double d, double vr, double accel, double dt);
}

/**
 * Auto-generated Ballistic Profile with Hessian support for curvature compensation.
 */
public class GeneratedShooterProfile implements ShooterProfile {

    // ── Hardware Constraints ─────────────────────────────────────────────────
    public final double MIN_SAFE_ANGLE = ${hardware.minAngle.toFixed(2)};
    public final double MAX_SAFE_ANGLE = ${hardware.maxAngle.toFixed(2)};

    public GeneratedShooterProfile() {}

    // ── Angle Prediction ─────────────────────────────────────────────────────

    @Override
    public double calculateAngle(double d, double vr) {
        double angle = ${getEq(models.normal?.angleModel, nAd)};
        return MathUtil.clamp(angle, MIN_SAFE_ANGLE, MAX_SAFE_ANGLE);
    }

    /** 1st Partial Derivative: ∂Angle / ∂Distance */
    @Override
    public double getAngleDerivativeWrtDistance(double d, double vr) {
        return ${getD1(models.normal?.angleModel, nAd, 'd')};
    }

    /** 1st Partial Derivative: ∂Angle / ∂RadialVelocity */
    @Override
    public double getAngleDerivativeWrtRadialVelocity(double d, double vr) {
        return ${getD1(models.normal?.angleModel, nAd, 'vr')};
    }

    /** 2nd Partial Derivative: ∂²Angle / ∂Distance² */
    @Override
    public double getAngleSecondDerivativeWrtDistance(double d, double vr) {
        return ${getD2(models.normal?.angleModel, nAd, 'd', 'd')};
    }

    /** Mixed Partial Derivative: ∂²Angle / ∂Distance∂RadialVelocity */
    @Override
    public double getAngleMixedDerivative(double d, double vr) {
        return ${getD2(models.normal?.angleModel, nAd, 'd', 'vr')};
    }

    // ── Velocity Prediction ──────────────────────────────────────────────────

    @Override
    public double calculateVelocity(double d, double vr) {
        double angle = calculateAngle(d, vr);
        if (angle <= MIN_SAFE_ANGLE) return ${getEq(models.min?.velocityModel, minVd)};
        if (angle >= MAX_SAFE_ANGLE) return ${getEq(models.max?.velocityModel, maxVd)};
        return ${getEq(models.normal?.velocityModel, nVd)};
    }

    /** 1st Partial Derivative: ∂Velocity / ∂Distance */
    @Override
    public double getVelocityDerivativeWrtDistance(double d, double vr) {
        double angle = calculateAngle(d, vr);
        if (angle <= MIN_SAFE_ANGLE) return ${getD1(models.min?.velocityModel, minVd, 'd')};
        if (angle >= MAX_SAFE_ANGLE) return ${getD1(models.max?.velocityModel, maxVd, 'd')};
        return ${getD1(models.normal?.velocityModel, nVd, 'd')};
    }

    /** 2nd Partial Derivative: ∂²Velocity / ∂Distance² */
    @Override
    public double getVelocitySecondDerivativeWrtDistance(double d, double vr) {
        double angle = calculateAngle(d, vr);
        if (angle <= MIN_SAFE_ANGLE) return ${getD2(models.min?.velocityModel, minVd, 'd', 'd')};
        if (angle >= MAX_SAFE_ANGLE) return ${getD2(models.max?.velocityModel, maxVd, 'd', 'd')};
        return ${getD2(models.normal?.velocityModel, nVd, 'd', 'd')};
    }

    // ── Advanced Control ─────────────────────────────────────────────────────

    /**
     * Calculates the estimated optimal angle adjusting for latency and acceleration.
     * Uses a Taylor expansion: f(t+dt) ≈ f(t) + f'(t)dt + 0.5f''(t)dt^2
     */
    @Override
    public double predictAngle(double d, double vr, double accel, double dt) {
        double current = calculateAngle(d, vr);
        
        // First order change (Chain rule via Jacobian)
        double dAdt = (getAngleDerivativeWrtDistance(d, vr) * -vr) + 
                      (getAngleDerivativeWrtRadialVelocity(d, vr) * accel);
        
        // Second order change (High precision curvature compensation via Hessian)
        double d2Adt2 = (getAngleSecondDerivativeWrtDistance(d, vr) * vr * vr) + 
                        (getAngleMixedDerivative(d, vr) * -vr * accel);

        return current + (dAdt * dt) + (0.5 * d2Adt2 * dt * dt);
    }
}`;
}

// ── Component ──────────────────────────────────────────────────────────────
type Tab = "angle" | "velocity" | "full";

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: "angle", label: "Angle equations" },
  { id: "velocity", label: "Velocity equations" },
  { id: "full", label: "Full Java class" },
];

export default function CodeExporter({
  models,
  hardware,
  datasetCounts,
}: Props) {
  const [tab, setTab] = useState<Tab>("full");
  const [copied, setCopied] = useState(false);
  
  const hasData = !!models.normal;

  const fullCode = useMemo(
    () => buildJavaCode(models, hardware),
    [models, hardware]
  );

  const displayCode = useMemo(() => {
    if (tab === "full") return fullCode;
    const isA = tab === "angle";
    const field = isA ? "angleModel" : "velocityModel";
    const deg = isA ? (models.normal?.angleDegree ?? 4) : (models.normal?.velocityDegree ?? 4);
    
    return `// ${tab.toUpperCase()} SECOND ORDER ANALYSIS
Equation: ${hasData ? generateEquation(models.normal?.[field] ?? null, deg) : "0.0"}

∂/∂d       = ${hasData ? generateDerivativeEquation(models.normal?.[field] ?? null, deg, 'd') : "0.0"}
∂²/∂d²     = ${hasData ? generateSecondDerivativeEquation(models.normal?.[field] ?? null, deg, 'd', 'd') : "0.0"}
∂²/∂d∂vr   = ${hasData ? generateSecondDerivativeEquation(models.normal?.[field] ?? null, deg, 'd', 'vr') : "0.0"}`;
  }, [tab, fullCode, models, hasData]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Polynomial term counts per regime
  const stats = useMemo(
    () => [
      {
        regime: "Normal",
        angleDegree: models.normal?.angleDegree ?? "—",
        velDegree: models.normal?.velocityDegree ?? "—",
        angleTerms: termCount(models.normal?.angleModel ?? null),
        velTerms: termCount(models.normal?.velocityModel ?? null),
        points: datasetCounts?.normal ?? 0,
      },
      {
        regime: "Min angle",
        angleDegree: models.min?.angleDegree === null ? "Const" : (models.min?.angleDegree ?? "—"),
        velDegree: models.min?.velocityDegree ?? "—",
        angleTerms: models.min?.angleDegree === null ? 1 : termCount(models.min?.angleModel ?? null),
        velTerms: termCount(models.min?.velocityModel ?? null),
        points: datasetCounts?.min ?? 0,
      },
      {
        regime: "Max angle",
        angleDegree: models.max?.angleDegree === null ? "Const" : (models.max?.angleDegree ?? "—"),
        velDegree: models.max?.velocityDegree ?? "—",
        angleTerms: models.max?.angleDegree === null ? 1 : termCount(models.max?.angleModel ?? null),
        velTerms: termCount(models.max?.velocityModel ?? null),
        points: datasetCounts?.max ?? 0,
      },
    ],
    [models, datasetCounts],
  );

  return (
    <div className="tab-config-card" style={{ 
      marginTop: 20, 
      borderLeft: `3px solid ${hasData ? "var(--accent-team)" : "#444"}`,
      background: "#0d0d12"
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ color: hasData ? "var(--accent-team)" : "#888", margin: 0 }}>
          {hasData ? "Generated Ballistics" : "Java Template (Awaiting Calibration)"}
        </h3>
        <button
          onClick={handleCopy}
          className="calculate-btn"
          style={{
            padding: "5px 14px",
            fontSize: "0.8rem",
            background: copied ? "#00ccff22" : "transparent",
            color: copied ? "var(--accent-team)" : "#aaa",
            border: `1px solid ${copied ? "var(--accent-team)" : "#333"}`,
            borderRadius: 6,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          {copied ? "✓ Copied!" : "Copy"}
        </button>
      </div>

      {/* Model stats mini-table */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        {stats.map((s) => (
          <div
            key={s.regime}
            style={{
              flex: 1,
              minWidth: 130,
              background: "#0a0a10",
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: "0.75rem",
              border: "1px solid #1e1e2a",
            }}
          >
            <div
              style={{
                color: "var(--accent-team)",
                fontWeight: 600,
                marginBottom: 4,
                fontSize: "0.7rem",
                textTransform: "uppercase",
              }}
            >
              {s.regime}
            </div>
            <div style={{ color: "#888" }}>
              Angle Deg: <span style={{ color: "#ccc" }}>{s.angleDegree}</span>
            </div>
            <div style={{ color: "#888" }}>
              Vel Deg: <span style={{ color: "#ccc" }}>{s.velDegree}</span>
            </div>
            <div style={{ color: "#888" }}>
              Angle terms: <span style={{ color: "#ccc" }}>{s.angleTerms}</span>
            </div>
            <div style={{ color: "#888" }}>
              Vel terms: <span style={{ color: "#ccc" }}>{s.velTerms}</span>
            </div>
            {s.points > 0 && (
              <div style={{ color: "#888" }}>
                Points:{" "}
                <span style={{ color: "#ccc" }}>
                  {s.points.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 2,
          marginBottom: 10,
          background: "#0a0a10",
          borderRadius: 8,
          padding: 3,
          width: "fit-content",
        }}
      >
        {TAB_LABELS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              padding: "5px 14px",
              fontSize: "0.78rem",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              background: tab === id ? "#1a1a28" : "transparent",
              color: tab === id ? "var(--accent-team)" : "#666",
              fontWeight: tab === id ? 600 : 400,
              transition: "all 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Code block */}
      <pre
        style={{
          background: "#08080e",
          padding: "14px 16px",
          borderRadius: 8,
          border: "1px solid #1e1e2a",
          color: "#d4d4d4",
          fontSize: "0.78rem",
          lineHeight: 1.55,
          overflowX: "auto",
          maxHeight: 480,
          overflowY: "auto",
          margin: 0,
        }} 
      >
        <code style={{ color: hasData ? "#d4d4d4" : "#666" }}>
          {displayCode}
        </code>
      </pre>
      
      {!hasData && (
        <div style={{ 
          fontSize: "0.7rem", 
          color: "var(--accent-team)", 
          marginTop: 8, 
          textAlign: "center",
          fontStyle: "italic" 
        }}>
          Note: Equations above are placeholders. Generate a surface to populate weights.
        </div>
      )}
    </div>
  );
}