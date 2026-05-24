import PlotlyComponent from "react-plotly.js";
import { useMemo } from "react";
import type { ModelState } from "./CodeExporter";
import { 
  type ValidationResult, 
  type RegimeValidation, 
} from "./SurfaceSweepView";
import { getQualityColor, TARGET_VARIABLES, VAR_KEYS } from "./shooterConfig";
import React from "react";

interface SurfaceSweepChartsProps {
  data: any;
  values: Record<string, number[][]> | null;
  residuals: Record<string, (number | null)[][]> | null;
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
    const result: Record<string, number[][]> = {};
    for (const key of VAR_KEYS) {
      result[key] = [];
      const matrixKey = TARGET_VARIABLES[key].matrixKey;
      for (let j = 0; j < radialVels.length; j++) {
        const row: number[] = [];
        for (let i = 0; i < distances.length; i++) {
          row.push(data[matrixKey]?.[i]?.[j] ?? null);
        }
        result[key].push(row);
      }
    }
    return result;
  }, [distances, radialVels, data]);

  // Generate hover text dynamically for each variable
  const hoverTexts = useMemo(() => {
    const result: Record<string, string[][]> = {};
    for (const key of VAR_KEYS) {
      const config = TARGET_VARIABLES[key];
      const safeResiduals = residuals?.[key] || transposedData[key].map(row => row.map(() => 0));
      
      result[key] = transposedData[key].map((row, j) =>
        row.map((zVal, i) => {
          if (zVal === null) return "";
          const err = safeResiduals[j][i];
          const errStr = err !== null ? `${err.toFixed(3)}${config.unit}` : "N/A";
          return `Distance: ${distances[i]}m<br>Radial Vel: ${radialVels[j]}m/s<br>${config.name}: ${zVal.toFixed(2)}${config.unit}<br>Error: ${errStr}`;
        })
      );
    }
    return result;
  }, [transposedData, residuals, distances, radialVels]);
  
  const polynomialSurfaceTrace = (z: number[][], name: string) => ({
    z, x: distances, y: radialVels, type: "surface" as const,
    colorscale: [[0, "#ffffff"], [1, "#ffffff"]],
    name, opacity: 0.15, showscale: false, hoverinfo: "skip" as const,
    contours: { x: { show: true, color: "#ffffff", width: 1 }, y: { show: true, color: "#ffffff", width: 1 }, z: { show: false } },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {validation.overall && (
        <AccuracyPanel validation={validation} models={models} />
      )}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {VAR_KEYS.map((key) => {
          const config = TARGET_VARIABLES[key];
          return (
            <div key={key} className="view-panel" style={{ flex: "1 1 360px", minHeight: 600 }}>
              <PanelLabel>{config.name} surface</PanelLabel>
              <Plot
                data={[
                  {
                    z: transposedData[key],
                    surfacecolor: residuals?.[key] || undefined,
                    text: hoverTexts[key],
                    hoverinfo: "text",
                    cmin: 0,
                    cmax: config.thresholds.acceptable, // Dynamic colorbar scaling based on thresholds
                    x: distances,
                    y: radialVels,
                    type: "surface",
                    colorscale: errorColorscale,
                    name: "Simulated",
                    colorbar: { title: { text: `Error (${config.unit})`, side: "right" }, thickness: 12, len: 0.7, tickfont: { color: "#888", size: 10 } },
                    hovertemplate: "%{text}<extra></extra>",
                  },
                  ...(values?.[key] ? [polynomialSurfaceTrace(values[key], "Polynomial")] : []),
                ]}
                layout={{ ...baseLayout, scene: makeScene(`${config.name} (${config.unit})`) }}
                config={plotConfig}
                useResizeHandler
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AccuracyPanel({ validation, models }: { validation: ValidationResult; models: any }) {
  const { overall } = validation;
  if (!overall) return null;

  // Find the worst performing variable to color the panel header
  let worstColor = "#00e676";
  for (const key of VAR_KEYS) {
    const err = parseFloat(overall[key]?.maxError || "0");
    const color = getQualityColor(key, err);
    if (color === "#ff5252") worstColor = "#ff5252";
    else if (color === "#ffd740" && worstColor !== "#ff5252") worstColor = "#ffd740";
  }

  return (
    <div className="tab-config-card" style={{ marginTop: 20, background: "#0d0d12" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ color: worstColor, margin: 0 }}>Polynomial Fit Accuracy</h2>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <RegimeBadge label="Normal" data={validation.normal} models={models.normal} />
        <RegimeBadge label="Min bounds" data={validation.min} models={models.min} />
        <RegimeBadge label="Max bounds" data={validation.max} models={models.max} />
      </div>

      <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 4, padding: "8px 12px", fontSize: "0.75rem", color: "#777", display: "flex", gap: 20, flexWrap: "wrap" }}>
        {VAR_KEYS.map((key) => {
           const config = TARGET_VARIABLES[key];
           return (
             <span key={`overall-${key}`}>
               {config.name} MaxErr: <strong style={{ color: "#aaa" }}>{overall[key]?.maxError}{config.unit}</strong>
             </span>
           );
        })}
      </div>
    </div>
  );
}

function RegimeBadge({ label, data, models }: { label: string; data: RegimeValidation | null; models: ModelState | null }) {
  if (!data || !models) return null;
  
  let worstColor = "#00e676";
  for (const key of VAR_KEYS) {
    const err = parseFloat(data.metrics[key]?.maxError || "0");
    const color = getQualityColor(key, err);
    if (color === "#ff5252") worstColor = "#ff5252";
    else if (color === "#ffd740" && worstColor !== "#ff5252") worstColor = "#ffd740";
  }

  return (
    <div style={{ background: "#0d0d12", border: `1px solid ${worstColor}33`, borderLeft: `3px solid ${worstColor}`, borderRadius: 6, padding: "10px 14px", flex: "1 1 180px" }}>
      <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: worstColor, marginBottom: 6, fontWeight: 600 }}>
        {label}
      </div>
      <table style={{ width: "100%", fontSize: "0.75rem", borderCollapse: "collapse" }}>
        <tbody>
          {VAR_KEYS.map(key => {
            const m = data.metrics[key];
            const deg = models.degrees[key];
            const config = TARGET_VARIABLES[key];
            if (!m) return null;

            return (
              <React.Fragment key={key}>
                <tr>
                  <td colSpan={2} style={{ fontSize: "0.6rem", color: "#444", paddingTop: 8, textTransform: "uppercase" }}>
                    {config.name} {deg === null ? "(CONST)" : `(DEG ${deg})`}
                  </td>
                </tr>
                <StatRow label="Max err" value={`${m.maxError}${config.unit}`} />
                <StatRow label="RMSE" value={`${m.rmse}${config.unit}`} />
                <StatRow label="R²" value={`${m.r2}%`} highlight={parseFloat(m.r2) > 99} />
              </React.Fragment>
            );
          })}
          <tr><td colSpan={2} style={{ paddingTop: 8 }} /></tr>
          <StatRow label="Points" value={data.count.toLocaleString()} />
        </tbody>
      </table>
    </div>
  );
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <tr>
      <td style={{ color: "#666", paddingRight: 8, paddingBottom: 1 }}>{label}</td>
      <td style={{ textAlign: "right", color: highlight ? "#00e676" : "#aaa", fontWeight: highlight ? 600 : 400 }}>{value}</td>
    </tr>
  );
}

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ margin: "0 0 8px 0", fontSize: "0.85rem", fontWeight: 500, color: "#aaa", letterSpacing: "0.04em", textTransform: "uppercase" }}>
      {children}
    </h3>
  );
}