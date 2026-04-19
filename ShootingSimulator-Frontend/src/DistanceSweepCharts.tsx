import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface DistanceSweepChartsProps {
  data: any; // Accept 'any' temporarily so we can safely parse the wrapper object
}

export default function DistanceSweepCharts({ data }: DistanceSweepChartsProps) {
  // SAFETY CHECK: Extract the array whether it is double-wrapped or not
  const chartData = Array.isArray(data) ? data : (data?.data || []);

  if (!chartData || chartData.length === 0) {
    return <div style={{ color: '#888', padding: '20px', textAlign: 'center' }}>Awaiting sweep data...</div>;
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: '#1c1c22', border: '1px solid #333', padding: '10px', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', borderBottom: '1px solid #333', paddingBottom: '4px' }}>
            Distance: {label}m
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} style={{ color: entry.color, margin: '4px 0' }}>
              {entry.name}: {entry.value ? `${entry.value}` : 'No Valid Shot'}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      
      {/* Angle Chart */}
      <div className="view-panel">
        <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#fff', flexShrink: 0 }}>Optimal Angle vs. Distance</h3>
        <div style={{ flexGrow: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }} syncId="distanceSweep">
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" vertical={false} />
              <XAxis dataKey="distanceX" stroke="#888" tick={{ fill: '#888', fontSize: 12 }} type="number" domain={['dataMin', 'dataMax']} />
              <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 12 }} domain={['auto', 'auto']} unit="°" />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="optimalAngle" name="Required Angle (°)" stroke="#00ff88" strokeWidth={3} dot={false} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Velocity Chart */}
      <div className="view-panel">
        <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#fff', flexShrink: 0 }}>Optimal Velocity vs. Distance</h3>
        <div style={{ flexGrow: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }} syncId="distanceSweep">
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" vertical={false} />
              <XAxis dataKey="distanceX" stroke="#888" tick={{ fill: '#888', fontSize: 12 }} type="number" domain={['dataMin', 'dataMax']} />
              <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 12 }} domain={['auto', 'auto']} unit=" m/s" />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="optimalVelocity" name="Required Velocity (m/s)" stroke="#4488ff" strokeWidth={3} dot={false} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}