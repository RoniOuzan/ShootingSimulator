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
  angleModel: MultivariateLinearRegression;
  velocityModel: MultivariateLinearRegression;
  degree: number;
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
export const getPolynomialFeatures = (d: number, vr: number, degree: number) => {
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
  isFirst: boolean
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
  degree: number
): string {
  if (!model) return "0.0";
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

// ── Java code generator ──────────────────────────────────────────────────────
function buildJavaCode(
  models: Props["models"],
  hardware: Props["hardware"]
): string {
  const nd = models.normal?.degree ?? 3;
  const cd = models.min?.degree ?? 2;
  const xd = models.max?.degree ?? 2;

  return `package frc.robot.util;

/**
 * Auto-generated ballistic lookup table.
 *
 * Normal regime:    degree-${nd} polynomial  (${termCount(models.normal?.angleModel ?? null)} angle terms, ${termCount(models.normal?.velocityModel ?? null)} vel terms)
 * Min-angle regime: degree-${cd} polynomial  (${termCount(models.min?.angleModel ?? null)} angle terms, ${termCount(models.min?.velocityModel ?? null)} vel terms)
 * Max-angle regime: degree-${xd} polynomial  (${termCount(models.max?.angleModel ?? null)} angle terms, ${termCount(models.max?.velocityModel ?? null)} vel terms)
 *
 * Parameters:
 *   d  – horizontal distance to target (m)
 *   vr – radial velocity of robot toward target (m/s)
 */
public final class ShooterBallistics {

    private ShooterBallistics() {}

    // ── Angle: normal regime ─────────────────────────────────────────────────
    private static double angleNormal(double d, double vr) {
        return ${generateEquation(models.normal?.angleModel ?? null, nd)};
    }

    // ── Angle: min-angle clamped regime ─────────────────────────────────────
    private static double angleMin(double d, double vr) {
        return ${generateEquation(models.min?.angleModel ?? null, cd)};
    }

    // ── Angle: max-angle clamped regime ─────────────────────────────────────
    private static double angleMax(double d, double vr) {
        return ${generateEquation(models.max?.angleModel ?? null, xd)};
    }

    /**
     * Returns the optimal shooter angle in degrees.
     * @param d  Distance to target (m)
     * @param vr Radial velocity toward target (m/s); positive = approaching
     */
    public static double calculateAngle(double d, double vr) {
        double normal = angleNormal(d, vr);
        if (normal <= ${hardware.minAngle}) return angleMin(d, vr);
        if (normal >= ${hardware.maxAngle}) return angleMax(d, vr);
        return normal;
    }

    // ── Velocity: normal regime ──────────────────────────────────────────────
    private static double velocityNormal(double d, double vr) {
        return ${generateEquation(models.normal?.velocityModel ?? null, nd)};
    }

    // ── Velocity: min-angle clamped regime ──────────────────────────────────
    private static double velocityMin(double d, double vr) {
        return ${generateEquation(models.min?.velocityModel ?? null, cd)};
    }

    // ── Velocity: max-angle clamped regime ──────────────────────────────────
    private static double velocityMax(double d, double vr) {
        return ${generateEquation(models.max?.velocityModel ?? null, xd)};
    }

    /**
     * Returns the optimal exit velocity in m/s.
     * Regime is determined by the angle prediction (same boundary conditions).
     * @param d  Distance to target (m)
     * @param vr Radial velocity toward target (m/s)
     */
    public static double calculateVelocity(double d, double vr) {
        double normal = angleNormal(d, vr);
        if (normal <= ${hardware.minAngle}) return velocityMin(d, vr);
        if (normal >= ${hardware.maxAngle}) return velocityMax(d, vr);
        return velocityNormal(d, vr);
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

export default function CodeExporter({ models, hardware, datasetCounts }: Props) {
  const [tab, setTab] = useState<Tab>("full");
  const [copied, setCopied] = useState(false);

  const fullCode = useMemo(
    () => buildJavaCode(models, hardware),
    [models, hardware]
  );

  const displayCode = useMemo(() => {
    if (tab === "full") return fullCode;

    const field = tab === "angle" ? "angleModel" : "velocityModel";
    const nd = models.normal?.degree ?? 3;
    const cd = models.min?.degree ?? 2;
    const xd = models.max?.degree ?? 2;
    const prefix = tab === "angle" ? "angle" : "velocity";
    const unit = tab === "angle" ? "°" : "m/s";

    return `// ${prefix} equations  (output: ${unit})

// Normal regime — degree-${nd} polynomial
${prefix}Normal(d, vr) =
  ${generateEquation(models.normal?.[field] ?? null, nd)}

// Min-angle clamped regime — degree-${cd} polynomial
${prefix}Min(d, vr) =
  ${generateEquation(models.min?.[field] ?? null, cd)}

// Max-angle clamped regime — degree-${xd} polynomial
${prefix}Max(d, vr) =
  ${generateEquation(models.max?.[field] ?? null, xd)}`;
  }, [tab, fullCode, models]);

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
        degree: models.normal?.degree ?? "—",
        angleTerms: termCount(models.normal?.angleModel ?? null),
        velTerms: termCount(models.normal?.velocityModel ?? null),
        points: datasetCounts?.normal ?? 0,
      },
      {
        regime: "Min angle",
        degree: models.min?.degree ?? "—",
        angleTerms: termCount(models.min?.angleModel ?? null),
        velTerms: termCount(models.min?.velocityModel ?? null),
        points: datasetCounts?.min ?? 0,
      },
      {
        regime: "Max angle",
        degree: models.max?.degree ?? "—",
        angleTerms: termCount(models.max?.angleModel ?? null),
        velTerms: termCount(models.max?.velocityModel ?? null),
        points: datasetCounts?.max ?? 0,
      },
    ],
    [models, datasetCounts]
  );

  return (
    <div
      className="tab-config-card"
      style={{ marginTop: 20, borderLeft: "3px solid #00ccff" }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <h3 style={{ color: "#00ccff", margin: 0 }}>Generated FRC constants</h3>
        <button
          onClick={handleCopy}
          className="calculate-btn"
          style={{
            padding: "5px 14px",
            fontSize: "0.8rem",
            background: copied ? "#00ccff22" : "transparent",
            color: copied ? "#00ccff" : "#aaa",
            border: `1px solid ${copied ? "#00ccff" : "#333"}`,
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
                color: "#00ccff",
                fontWeight: 600,
                marginBottom: 4,
                fontSize: "0.7rem",
                textTransform: "uppercase",
              }}
            >
              {s.regime}
            </div>
            <div style={{ color: "#888" }}>
              Degree: <span style={{ color: "#ccc" }}>{s.degree}</span>
            </div>
            <div style={{ color: "#888" }}>
              Angle terms: <span style={{ color: "#ccc" }}>{s.angleTerms}</span>
            </div>
            <div style={{ color: "#888" }}>
              Vel terms: <span style={{ color: "#ccc" }}>{s.velTerms}</span>
            </div>
            {s.points > 0 && (
              <div style={{ color: "#888" }}>
                Points: <span style={{ color: "#ccc" }}>{s.points.toLocaleString()}</span>
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
              color: tab === id ? "#00ccff" : "#666",
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
        <code>{displayCode}</code>
      </pre>
    </div>
  );
}