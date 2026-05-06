import { useMemo } from 'react';
import PlotlyComponent from 'react-plotly.js';
import { getPolynomialFeatures, type ModelState } from './CodeExporter';

interface SurfaceSweepChartsProps {
  data: {
    distances?: number[];        // 1D array of X coordinates (e.g., [1, 2, 3...])
    radialVels?: number[];       // 1D array of Y coordinates (e.g., [-4, -2, 0, 2, 4])
    angleMatrix?: number[][];    // 2D array of Z coordinates for angles
    velocityMatrix?: number[][]; // 2D array of Z coordinates for velocities
  },
  models: {
    normal: ModelState | null,
    min: ModelState | null,
    max: ModelState | null,
  },
  hardware: { minAngle: number; maxAngle: number };
}

const Plot = (PlotlyComponent as any).default || PlotlyComponent;

export default function SurfaceSweepCharts({ data, models, hardware }: SurfaceSweepChartsProps) {
  if (!models || !data || !data.angleMatrix || !data.velocityMatrix) {
    return <div style={{ color: '#888', padding: '20px', textAlign: 'center' }}>Awaiting 3D surface data...</div>;
  }

  const predicted = useMemo(() => {
    if (!models || !data.distances || !data.radialVels) return null;

    const angle: number[][] = [];
    const velocity: number[][] = [];

    for (let i = 0; i < data.distances.length; i++) {
      const rowA: number[] = [];
      const rowV: number[] = [];

      for (let j = 0; j < data.radialVels.length; j++) {
        const d = data.distances[i];
        const vr = data.radialVels[j];

        // 1. Determine which model to use
        // First, get the prediction from the 'normal' model to check boundaries
        const normalFeatures = getPolynomialFeatures(d, vr, models.normal?.degree ?? 3).features;
        const normalAngle = models.normal?.angleModel.predict([normalFeatures])[0][0] ?? 0;

        let modelToUse: ModelState | null;
        
        // 2. Select the regime based on the normal prediction
        if (normalAngle <= hardware.minAngle) {
          modelToUse = models.min;
        } else if (normalAngle >= hardware.maxAngle) {
          modelToUse = models.max;
        } else {
          modelToUse = models.normal;
        }

        // 3. Perform prediction using the selected model
        if (modelToUse) {
          const features = getPolynomialFeatures(d, vr, modelToUse.degree).features;
          rowA.push(modelToUse.angleModel.predict([features])[0][0]);
          rowV.push(modelToUse.velocityModel.predict([features])[0][0]);
        } else {
          rowA.push(normalAngle);
          rowV.push(0); // Fallback
        }
      }
      angle.push(rowA);
      velocity.push(rowV);
    }

    return { angle, velocity };
  }, [models, data]);

  // Dark theme layout configuration for Plotly
  const layoutTemplate: Partial<Plotly.Layout> = {
    autosize: true,
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#ffffff' },
    margin: { l: 0, r: 0, b: 0, t: 30 },
    scene: {
      xaxis: { title: { text: 'Distance (m)' }, gridcolor: '#333', backgroundcolor: '#1c1c22', showbackground: true },
      yaxis: { title: { text: 'Radial Vel (m/s)' }, gridcolor: '#333', backgroundcolor: '#1c1c22', showbackground: true },
      zaxis: { gridcolor: '#333', backgroundcolor: '#1c1c22', showbackground: true },
      camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: '20px', height: '100%' }}>
      
      {/* 3D Angle Surface */}
      <div className="view-panel" style={{ flex: 1, minHeight: '400px', minWidth: 0 }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#fff' }}>Optimal Angle Surface</h3>
        <Plot
          data={[
            {
              z: data.angleMatrix,
              x: data.distances,
              y: data.radialVels,
              type: 'surface',
              colorscale: 'Viridis',
              name: 'Raw Data',
              colorbar: { title: 'Angle', len: 0.5 }
            },
            ...(predicted ? [{
              z: predicted.angle,
              x: data.distances,
              y: data.radialVels,
              type: 'surface',
              colorscale: 'RdBu',
              name: 'Polynomial',
              opacity: 0.5,
              showscale: false,
            }] : [])
          ]}
          layout={{
            ...layoutTemplate,
            scene: { 
              ...layoutTemplate.scene, 
              zaxis: { ...layoutTemplate.scene?.zaxis, title: { text: 'Angle (°)' } }
            }
          }}
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* 3D Velocity Surface */}
      <div className="view-panel" style={{ flex: 1, minHeight: '400px', minWidth: 0 }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#fff' }}>Optimal Velocity Surface</h3>
        <Plot
          data={[
            {
              z: data.velocityMatrix,
              x: data.distances,
              y: data.radialVels,
              type: 'surface',
              colorscale: 'Plasma',
              colorbar: { title: { text: 'Velocity (m/s)' }, thickness: 15, len: 0.8 }
            },
            ...(predicted ? [{
              z: predicted.velocity,
              x: data.distances,
              y: data.radialVels,
              type: 'surface',
              colorscale: 'RdBu',
              name: 'Polynomial',
              opacity: 0.5,
              showscale: false,
            }] : [])
          ]}
          layout={{
            ...layoutTemplate,
            scene: { 
              ...layoutTemplate.scene, 
              zaxis: { ...layoutTemplate.scene?.zaxis, title: { text: 'Velocity (m/s)' } }
            }
          }}
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

    </div>
  );
}