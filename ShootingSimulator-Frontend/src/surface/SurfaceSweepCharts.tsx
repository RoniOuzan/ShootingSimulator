import PlotlyComponent from "react-plotly.js";
import { useMemo, useState } from "react";
import type { ModelState } from "./CodeExporter";
import { type ValidationResult, type RegimeValidation, QUALITY_COLOR } from "./SurfaceSweepView";

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
  /** Absolute angle error per grid cell, same shape as angleMatrix */
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

// Shared scene configuration to reduce repetition
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

export default function SurfaceSweepCharts({
  data,
  values,
  residuals,
  validation,
  models,
}: SurfaceSweepChartsProps) {
  const [showResiduals, setShowResiduals] = useState(false);
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

  // Plotly surface expects z[row][col] where row is y (Radial Vel) and col is x (Distance).
  // The solver sends data as [distance_index][vel_index].
  // We must transpose the simulated matrices for visual alignment.
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

  const polynomialSurfaceTrace = (z: number[][], name: string) => ({
    z,
    x: distances,
    y: radialVels,
    type: "surface" as const,
    colorscale: "RdBu",
    name,
    opacity: 0.55,
    showscale: false,
    contours: {
      z: { show: true, usecolormap: true, project: { z: true } },
    },
  });

  const renderHeatmap = (
    z: (number | null)[][],
    title: string,
    unit: string,
    max: number,
  ) => (
    <div style={{ flex: "1 1 300px", minWidth: 0 }}>
      <div style={{ marginBottom: 8, paddingLeft: 4 }}>
        <PanelLabel>{title}</PanelLabel>
        <div style={{ fontSize: "0.7rem", color: "#555", marginTop: -6 }}>
          |predicted - simulated| in {unit}
        </div>
      </div>
      <Plot
        data={[
          {
            z,
            x: distances,
            y: radialVels,
            type: "heatmap",
            zmin: 0,
            zmax: max,
            colorscale: [
              [0, "#003300"],
              [0.05, "#00aa44"],
              [0.25, "#ffd740"],
              [1, "#ff5252"],
            ],
            colorbar: {
              thickness: 10,
              len: 0.8,
              tickfont: { color: "#666", size: 9 },
            },
            hoverongaps: false,
            zsmooth: "best",
          },
        ]}
        layout={{
          ...baseLayout,
          height: 220,
          margin: { l: 35, r: 50, b: 35, t: 5 },
          xaxis: { gridcolor: "#1e1e28", tickfont: { size: 9 } },
          yaxis: { gridcolor: "#1e1e28", tickfont: { size: 9 } },
        }}
        config={plotConfig}
        useResizeHandler
        style={{ width: "100%", height: 220 }}
      />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top row: angle + velocity side by side */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* ── Angle surface ── */}
        <div
          className="view-panel"
          style={{ flex: "1 1 360px", minHeight: 420 }}
        >
          <PanelLabel>Optimal angle surface</PanelLabel>
          <Plot
            data={[
              {
                z: transposedData.angle,
                x: distances,
                y: radialVels,
                type: "surface",
                colorscale: "Viridis",
                name: "Simulated",
                colorbar: {
                  title: { text: "°", side: "right" },
                  thickness: 12,
                  len: 0.7,
                  tickfont: { color: "#888", size: 10 },
                },
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
          style={{ flex: "1 1 360px", minHeight: 420 }}
        >
          <PanelLabel>Optimal velocity surface</PanelLabel>
          <Plot
            data={[
              {
                z: transposedData.velocity,
                x: distances,
                y: radialVels,
                type: "surface",
                colorscale: "Plasma",
                name: "Simulated",
                colorbar: {
                  title: { text: "m/s", side: "right" },
                  thickness: 12,
                  len: 0.7,
                  tickfont: { color: "#888", size: 10 },
                },
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

      {/* Residuals Card Section */}
      {residuals && (residuals.angle || residuals.velocity) && (
        <div
          style={{
            background: "#0d0d12", // Matched to your "Awaiting data" background
            borderRadius: 10,
            border: "1px solid #2a2a35",
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => setShowResiduals(!showResiduals)}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              padding: "14px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <span
              style={{
                color: "#aaa",
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Model Fidelity Residuals
            </span>
            <div
              style={{
                color: "#555",
                fontSize: "0.6rem",
                transform: showResiduals ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              ▼
            </div>
          </button>

          <div
            style={{
              maxHeight: showResiduals ? "1200px" : "0px",
              opacity: showResiduals ? 1 : 0,
              transition: "max-height 0.3s ease-in-out, opacity 0.3s ease",
              overflow: "hidden",
              background: "rgba(255,255,255,0.02)", // Subtle lift
            }}
          >
            <div
              style={{
                padding: "20px 16px",
                borderTop: "1px solid #1a1a24",
              }}
            >
              {/* Accuracy Stats Integration */}
              {validation.overall && (
                <div style={{ marginBottom: 24 }}>
                  <AccuracyPanel validation={validation} models={models} />
                </div>
              )}

              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                {residuals.angle &&
                  renderHeatmap(residuals.angle, "Angle Error", "°", 0.5)}
                {residuals.velocity &&
                  renderHeatmap(
                    residuals.velocity,
                    "Velocity Error",
                    "m/s",
                    0.2,
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
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
  angleDegree: number;
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
          deg {angleDegree}/{velDegree}
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
  const isGood =
    parseFloat(overall.angleMaxError) < 0.1 &&
    parseFloat(overall.velMaxError) < 0.05;

  return (
    <div style={{ borderLeft: `2px solid ${overallColor}`, paddingLeft: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: "0.8rem",
            fontWeight: 600,
            color: "#ccc",
            textTransform: "uppercase",
          }}
        >
          Polynomial fit accuracy
        </div>
        <span
          style={{
            fontSize: "0.65rem",
            padding: "2px 8px",
            borderRadius: 12,
            background: `${overallColor}15`,
            color: overallColor,
            border: `1px solid ${overallColor}33`,
            fontWeight: 600,
          }}
        >
          {isGood
            ? "✓ Excellent"
            : parseFloat(overall.angleMaxError) < 0.5 &&
                parseFloat(overall.velMaxError) < 0.2
              ? "⚠ Acceptable"
              : "✗ Poor fit"}
        </span>
      </div>

      <div
        style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}
      >
        <RegimeBadge
          label="Normal"
          data={validation.normal}
          angleDegree={models.normal?.angleDegree ?? 4}
          velDegree={models.normal?.velocityDegree ?? 4}
        />
        <RegimeBadge
          label="Min angle"
          data={validation.min}
          angleDegree={models.min?.angleDegree ?? 1}
          velDegree={models.min?.velocityDegree ?? 2}
        />
        <RegimeBadge
          label="Max angle"
          data={validation.max}
          angleDegree={models.max?.angleDegree ?? 1}
          velDegree={models.max?.velocityDegree ?? 2}
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
