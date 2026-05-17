import PlotlyComponent from "react-plotly.js";
import { useMemo } from "react";
import type { ModelState } from "./CodeExporter";
import { 
  type ValidationResult, 
  type RegimeValidation, 
  QUALITY_COLOR, 
  FIT_THRESHOLDS, 
  POLYNOMIAL_DEGREES 
} from "./SurfaceSweepView";

interface SurfaceSweepChartsProps {
  data: {
    distances?: number[];
    radialVels?: number[];
    angleMatrix?: number[][];
    velocityMatrix?: number[][];
  };
  values: {
    angle: number[][];
    velocity: number[][];
  } | null;
  residuals: {
    angle: (number | null)[][] | null;
    velocity: (number | null)[][] | null;
  } | null;
  validation: ValidationResult;
  models: {
    normal: ModelState | null;
    min: ModelState | null;
    max: ModelState | null;
  };
}

const Plot = (PlotlyComponent as any).default || PlotlyComponent;

const makeScene = (zTitle: string): Partial<Plotly.Scene> => ({
  xaxis: {
    title: { text: "Distance (m)" },
    gridcolor: "#2a2a35",
    backgroundcolor: "#12121a",
    showbackground: true,
    tickfont: { color: "#888", size: 10 },
  },
  yaxis: {
    title: { text: "Radial vel (m/s)" },
    gridcolor: "#2a2a35",
    backgroundcolor: "#12121a",
    showbackground: true,
    tickfont: { color: "#888", size: 10 },
  },
  zaxis: {
    title: { text: zTitle },
    gridcolor: "#2a2a35",
    backgroundcolor: "#12121a",
    showbackground: true,
    tickfont: { color: "#888", size: 10 },
  },
  camera: { eye: { x: 1.6, y: 1.6, z: 1.1 } },
});

const baseLayout: Partial<Plotly.Layout> = {
  autosize: true,
  paper_bgcolor: "transparent",
  plot_bgcolor: "transparent",
  font: { color: "#ccc", family: "monospace" },
  margin: { l: 0, r: 0, b: 0, t: 28 },
  hovermode: "closest",
  legend: {
    x: 0.02,
    y: 0.98,
    bgcolor: "#1a1a22cc",
    bordercolor: "#333",
    borderwidth: 1,
    font: { size: 11 },
  },
};

const plotConfig = {
  displayModeBar: true,
  modeBarButtonsToRemove: [
    "toImage",
    "sendDataToCloud",
    "hoverClosest3d",
  ] as any[],
  displaylogo: false,
  responsive: true,
};

const errorColorscale = [
  [0, "#003300"],
  [0.05, "#00aa44"],
  [0.25, "#ffd740"],
  [1, "#ff5252"],
];

export default function SurfaceSweepCharts({
  data,
  values,
  residuals,
  validation,
  models,
}: SurfaceSweepChartsProps) {
  const { distances, radialVels, angleMatrix, velocityMatrix } = data;

  if (!distances || !radialVels || !angleMatrix || !velocityMatrix) {
    return (
      <div
        style={{
          color: "#555",
          padding: "40px 20px",
          textAlign: "center",
          background: "#0d0d12",
          borderRadius: 10,
          border: "1px dashed #2a2a35",
          fontSize: "0.9rem",
        }}
      >
        Awaiting 3D surface data…
      </div>
    );
  }

  const transposedData = useMemo(() => {
    const distCount = distances!.length;
    const velCount = radialVels!.length;

    const transposedAngle: number[][] = [];
    const transposedVel: number[][] = [];

    for (let j = 0; j < velCount; j++) {
      const rowA: number[] = [];
      const rowV: number[] = [];
      for (let i = 0; i < distCount; i++) {
        rowA.push(angleMatrix![i]?.[j] ?? null);
        rowV.push(velocityMatrix![i]?.[j] ?? null);
      }
      transposedAngle.push(rowA);
      transposedVel.push(rowV);
    }

    return { angle: transposedAngle, velocity: transposedVel };
  }, [distances, radialVels, angleMatrix, velocityMatrix]);

  const angleHoverText = useMemo(() => {
    const safeAngleResiduals = residuals?.angle || transposedData.angle.map(row => row.map(() => 0));
    
    return transposedData.angle.map((row, j) =>
      row.map((zVal, i) => {
        if (zVal === null) return "";
        const err = safeAngleResiduals[j][i];
        const errStr = err !== null ? `${err.toFixed(3)}°` : "N/A";
        return `Distance: ${distances[i]}m<br>Radial Vel: ${radialVels[j]}m/s<br>Angle: ${zVal.toFixed(2)}°<br>Error: ${errStr}`;
      })
    );
  }, [transposedData.angle, residuals?.angle, distances, radialVels]);

  const velHoverText = useMemo(() => {
    const safeVelResiduals = residuals?.velocity || transposedData.velocity.map(row => row.map(() => 0));

    return transposedData.velocity.map((row, j) =>
      row.map((zVal, i) => {
        if (zVal === null) return "";
        const err = safeVelResiduals[j][i];
        const errStr = err !== null ? `${err.toFixed(3)}m/s` : "N/A";
        return `Distance: ${distances[i]}m<br>Radial Vel: ${radialVels[j]}m/s<br>Velocity: ${zVal.toFixed(2)}m/s<br>Error: ${errStr}`;
      })
    );
  }, [transposedData.velocity, residuals?.velocity, distances, radialVels]);
  
  const polynomialSurfaceTrace = (z: number[][], name: string) => ({
    z,
    x: distances,
    y: radialVels,
    type: "surface" as const,
    colorscale: [[0, "#ffffff"], [1, "#ffffff"]],
    name,
    opacity: 0.15,
    showscale: false,
    hoverinfo: "skip" as const, // Prevents this invisible layer from catching the mouse raycaster
    contours: {
      x: { show: true, color: "#ffffff", width: 1 },
      y: { show: true, color: "#ffffff", width: 1 },
      z: { show: false },
    },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Accuracy Panel (Always Visible) */}
      {validation.overall && (
        <AccuracyPanel validation={validation} models={models} />
      )}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        
        {/* ── Angle surface ── */}
        <div
          className="view-panel"
          style={{ flex: "1 1 360px", minHeight: 600 }}
        >
          <PanelLabel>Optimal angle surface</PanelLabel>
          <Plot
            data={[
              {
                z: transposedData.angle,
                surfacecolor: residuals?.angle || undefined,
                text: angleHoverText,
                hoverinfo: "text",
                cmin: 0,
                cmax: 0.5,
                x: distances,
                y: radialVels,
                type: "surface",
                colorscale: errorColorscale,
                name: "Simulated",
                colorbar: {
                  title: { text: "Error (°)", side: "right" },
                  thickness: 12,
                  len: 0.7,
                  tickfont: { color: "#888", size: 10 },
                },
                hovertemplate: "%{text}<extra></extra>",
              },
              ...(values
                ? [polynomialSurfaceTrace(values.angle, "Polynomial")]
                : []),
            ]}
            layout={{
              ...baseLayout,
              scene: makeScene("Angle (°)"),
            }}
            config={plotConfig}
            useResizeHandler
            style={{ width: "100%", height: "100%" }}
          />
        </div>

        {/* ── Velocity surface ── */}
        <div
          className="view-panel"
          style={{ flex: "1 1 360px", minHeight: 600 }}
        >
          <PanelLabel>Optimal velocity surface</PanelLabel>
          <Plot
            data={[
              {
                z: transposedData.velocity,
                surfacecolor: residuals?.velocity || undefined,
                text: velHoverText,
                hoverinfo: "text",
                cmin: 0,
                cmax: 0.2,
                x: distances,
                y: radialVels,
                type: "surface",
                colorscale: errorColorscale,
                name: "Simulated",
                colorbar: {
                  title: { text: "Error (m/s)", side: "right" },
                  thickness: 12,
                  len: 0.7,
                  tickfont: { color: "#888", size: 10 },
                },
                hovertemplate: "%{text}<extra></extra>",
              },
              ...(values
                ? [polynomialSurfaceTrace(values.velocity, "Polynomial")]
                : []),
            ]}
            layout={{
              ...baseLayout,
              scene: makeScene("Velocity (m/s)"),
            }}
            config={plotConfig}
            useResizeHandler
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </div>
    </div>
  );
}

function RegimeBadge({
  label,
  data,
  angleDegree,
  velDegree,
}: {
  label: string;
  data: RegimeValidation | null;
  angleDegree: number | null;
  velDegree: number;
}) {
  if (!data) return null;
  const color = QUALITY_COLOR(
    parseFloat(data.angleMaxError),
    parseFloat(data.velMaxError),
  );
  return (
    <div
      style={{
        background: "#0d0d12",
        border: `1px solid ${color}33`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        padding: "10px 14px",
        flex: "1 1 180px",
      }}
    >
      <div
        style={{
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: color,
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        {label}
        <span
          style={{
            marginLeft: 6,
            color: "#555",
            fontWeight: 400,
            textTransform: "none",
          }}
        >
          {angleDegree === null ? "Const" : `deg ${angleDegree}`}/{velDegree}
        </span>
      </div>
      <table
        style={{
          width: "100%",
          fontSize: "0.75rem",
          borderCollapse: "collapse",
        }}
      >
        <tbody>
          <tr>
            <td
              colSpan={2}
              style={{ fontSize: "0.6rem", color: "#444", paddingTop: 4 }}
            >
              ANGLE
            </td>
          </tr>
          <StatRow label="Max err" value={`${data.angleMaxError}°`} />
          <StatRow label="RMSE" value={`${data.angleRmse}°`} />
          <StatRow
            label="R²"
            value={`${data.angleR2}%`}
            highlight={parseFloat(data.angleR2) > 99}
          />
          <tr>
            <td
              colSpan={2}
              style={{ fontSize: "0.6rem", color: "#444", paddingTop: 8 }}
            >
              VELOCITY
            </td>
          </tr>
          <StatRow label="Max err" value={`${data.velMaxError}m/s`} />
          <StatRow label="RMSE" value={`${data.velRmse}m/s`} />
          <StatRow
            label="R²"
            value={`${data.velR2}%`}
            highlight={parseFloat(data.velR2) > 99}
          />
          <StatRow label="Points" value={data.count.toLocaleString()} />
        </tbody>
      </table>
    </div>
  );
}

function StatRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <tr>
      <td style={{ color: "#666", paddingRight: 8, paddingBottom: 1 }}>
        {label}
      </td>
      <td
        style={{
          textAlign: "right",
          color: highlight ? "#00e676" : "#aaa",
          fontWeight: highlight ? 600 : 400,
        }}
      >
        {value}
      </td>
    </tr>
  );
}

function AccuracyPanel({
  validation,
  models,
}: {
  validation: ValidationResult;
  models: any;
}) {
  const { overall } = validation;
  if (!overall) return null;

  const overallColor = QUALITY_COLOR(
    parseFloat(overall.angleMaxError),
    parseFloat(overall.velMaxError),
  );
  
  const isExcellent =
    parseFloat(overall.angleMaxError) <= FIT_THRESHOLDS.EXCELLENT.ANGLE_MAX_ERR &&
    parseFloat(overall.velMaxError) <= FIT_THRESHOLDS.EXCELLENT.VEL_MAX_ERR;
    
  const isAcceptable =
    parseFloat(overall.angleMaxError) <= FIT_THRESHOLDS.ACCEPTABLE.ANGLE_MAX_ERR &&
    parseFloat(overall.velMaxError) <= FIT_THRESHOLDS.ACCEPTABLE.VEL_MAX_ERR;

  return (
    <div className="tab-config-card" style={{ 
      marginTop: 20, 
      background: "#0d0d12"
    }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h2
          style={{ color: `${overallColor}`, margin: 0 }}
        >
          Polynomial Fit Accuracy
        </h2>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 12,
            background: `${overallColor}15`,
            color: overallColor,
            border: `1px solid ${overallColor}33`,
            fontWeight: 600,
          }}
        >
          {isExcellent
            ? FIT_THRESHOLDS.EXCELLENT.LABEL
            : isAcceptable
            ? FIT_THRESHOLDS.ACCEPTABLE.LABEL
            : FIT_THRESHOLDS.POOR.LABEL}
        </span>
      </div>

      <div
        style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}
      >
        <RegimeBadge
          label="Normal"
          data={validation.normal}
          angleDegree={models.normal?.angleDegree ?? POLYNOMIAL_DEGREES.NORMAL.ANGLE}
          velDegree={models.normal?.velocityDegree ?? POLYNOMIAL_DEGREES.NORMAL.VELOCITY}
        />
        <RegimeBadge
          label="Min angle"
          data={validation.min}
          angleDegree={models.min?.angleDegree ?? POLYNOMIAL_DEGREES.MIN.ANGLE}
          velDegree={models.min?.velocityDegree ?? POLYNOMIAL_DEGREES.MIN.VELOCITY}
        />
        <RegimeBadge
          label="Max angle"
          data={validation.max}
          angleDegree={models.max?.angleDegree ?? POLYNOMIAL_DEGREES.MAX.ANGLE}
          velDegree={models.max?.velocityDegree ?? POLYNOMIAL_DEGREES.MAX.VELOCITY}
        />
      </div>

      <div
        style={{
          background: "rgba(0,0,0,0.2)",
          borderRadius: 4,
          padding: "8px 12px",
          fontSize: "0.75rem",
          color: "#777",
          display: "flex",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <span>
          Angle MaxErr:{" "}
          <strong style={{ color: "#aaa" }}>{overall.angleMaxError}°</strong>
        </span>
        <span>
          Vel MaxErr:{" "}
          <strong style={{ color: "#aaa" }}>{overall.velMaxError}m/s</strong>
        </span>
        <span>
          RMSE:{" "}
          <strong style={{ color: "#555" }}>
            {overall.angleRmse}° / {overall.velRmse}m/s
          </strong>
        </span>
      </div>
    </div>
  );
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        margin: "0 0 8px 0",
        fontSize: "0.85rem",
        fontWeight: 500,
        color: "#aaa",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {children}
    </h3>
  );
}