import PlotlyComponent from 'react-plotly.js';

interface SurfaceSweepChartsProps {
  data: {
    distances?: number[];        // 1D array of X coordinates (e.g., [1, 2, 3...])
    radialVels?: number[];       // 1D array of Y coordinates (e.g., [-4, -2, 0, 2, 4])
    angleMatrix?: number[][];    // 2D array of Z coordinates for angles
    velocityMatrix?: number[][]; // 2D array of Z coordinates for velocities
  };
}

const Plot = (PlotlyComponent as any).default || PlotlyComponent;

export default function SurfaceSweepCharts({ data }: SurfaceSweepChartsProps) {
  if (!data || !data.angleMatrix || !data.velocityMatrix) {
    return <div style={{ color: '#888', padding: '20px', textAlign: 'center' }}>Awaiting 3D surface data...</div>;
  }

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
    // 1. Changed flexDirection to 'row'
    <div style={{ display: 'flex', flexDirection: 'row', gap: '20px', height: '100%' }}>
      
      {/* 3D Angle Surface */}
      <div className="view-panel" style={{ flex: 1, minHeight: '400px', minWidth: 0 }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#fff' }}>Optimal Angle Surface</h3>
        <Plot
          data={[{
            z: data.angleMatrix,
            x: data.distances,
            y: data.radialVels,
            type: 'surface',
            colorscale: 'Viridis',
            colorbar: { title: { text: 'Angle (°)' }, thickness: 15, len: 0.8 }
          }]}
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
          data={[{
            z: data.velocityMatrix,
            x: data.distances,
            y: data.radialVels,
            type: 'surface',
            colorscale: 'Plasma',
            colorbar: { title: { text: 'Velocity (m/s)' }, thickness: 15, len: 0.8 }
          }]}
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