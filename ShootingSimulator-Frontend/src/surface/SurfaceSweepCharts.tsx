import PlotlyComponent from "react-plotly.js";

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
  residuals: number[][] | null;
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
}: SurfaceSweepChartsProps) {
  if (!data?.angleMatrix || !data?.velocityMatrix) {
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

  const polynomialSurfaceTrace = (z: number[][], name: string) => ({
    z,
    x: data.distances,
    y: data.radialVels,
    type: "surface" as const,
    colorscale: "RdBu",
    name,
    opacity: 0.55,
    showscale: false,
    contours: {
      z: { show: true, usecolormap: true, project: { z: true } },
    },
  });

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
                z: data.angleMatrix,
                x: data.distances,
                y: data.radialVels,
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
                z: data.velocityMatrix,
                x: data.distances,
                y: data.radialVels,
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

      {/* Bottom row: residual heatmap (only once polynomial is fitted) */}
      {residuals && (
        <div className="view-panel" style={{ minHeight: 280 }}>
          <PanelLabel>
            Angle residual map{" "}
            <span style={{ color: "#555", fontWeight: 400 }}>
              |predicted − simulated| in degrees
            </span>
          </PanelLabel>
          <Plot
            data={[
              {
                z: residuals,
                x: data.distances,
                y: data.radialVels,
                type: "heatmap",
                colorscale: [
                  [0, "#003300"],
                  [0.05, "#00aa44"],
                  [0.25, "#ffd740"],
                  [1, "#ff5252"],
                ],
                colorbar: {
                  title: { text: "Error (°)", side: "right" },
                  thickness: 12,
                  tickfont: { color: "#888", size: 10 },
                },
                hoverongaps: false,
                zsmooth: "best",
              },
            ]}
            layout={{
              ...baseLayout,
              margin: { l: 60, r: 80, b: 50, t: 10 },
              xaxis: {
                title: { text: "Distance (m)" },
                color: "#888",
                gridcolor: "#1e1e28",
              },
              yaxis: {
                title: { text: "Radial vel (m/s)" },
                color: "#888",
                gridcolor: "#1e1e28",
              },
            }}
            config={plotConfig}
            useResizeHandler
            style={{ width: "100%", height: 260 }}
          />
        </div>
      )}
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