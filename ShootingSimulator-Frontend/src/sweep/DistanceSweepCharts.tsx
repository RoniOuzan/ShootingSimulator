import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface DistanceSweepChartsProps {
  data: any; // Accept 'any' temporarily so we can safely parse the wrapper object
}

export const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#1c1c22', border: '1px solid #333', padding: '10px', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', borderBottom: '1px solid #333', paddingBottom: '4px' }}>
          Distance: {label}m
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={index} style={{ color: entry.color, margin: '4px 0' }}>
            {entry.name}: {entry.value != null ? `${entry.value}` : 'No Valid Shot'}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function DistanceSweepCharts({ data }: DistanceSweepChartsProps) {
  // SAFETY CHECK: Extract the array whether it is double-wrapped or not
  const chartData = Array.isArray(data) ? data : (data?.data || []);

  if (!chartData || chartData.length === 0) {
    return <div style={{ color: '#888', padding: '20px', textAlign: 'center' }}>Awaiting sweep data...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
      
      <Chart title={'Optimal Angle'} data={chartData} value="optimalAngle" color="#00ff88" unit="°" derivative="angleDerivative" />
      <Chart title={'Optimal Velocity'} data={chartData} value="optimalVelocity" color="#4488ff" unit="m/s" derivative="velocityDerivative" />
      
      <Chart title={'Tolerance Velocity Positive'} data={chartData} value="tolVelPos" color="#00ff88" unit="m/s" />
      <Chart title={'Tolerance Velocity Negative'} data={chartData} value="tolVelNeg" color="#ff4444" unit="m/s" />
      
      <Chart title={'Tolerance Angle Positive'} data={chartData} value="tolAnglePos" color="#00ff88" unit="°" />
      <Chart title={'Tolerance Angle Negative'} data={chartData} value="tolAngleNeg" color="#ff4444" unit="°" />
    </div>
  );
}

const Chart = ({ title, data, value, color, unit, derivative }: { title: string; data: any[]; value: string; color: string; unit: string; derivative?: string }) => {
  return (
    <div className="view-panel">
      <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#fff', flexShrink: 0 }}>{title}</h3>
      <div style={{ flexGrow: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 0 }} syncId="distanceSweep">
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" vertical={false} />
            <XAxis dataKey="distanceX" stroke="#888" tick={{ fill: '#888', fontSize: 12 }} type="number" domain={['dataMin', 'dataMax']} />
            <YAxis yAxisId="left" stroke="#888" tick={{ fill: '#888', fontSize: 12 }} domain={['auto', 'auto']} unit={unit} />
            {derivative && <YAxis yAxisId="right" orientation="right" stroke="#888" tick={{ fill: '#888', fontSize: 12 }} domain={['auto', 'auto']} unit={unit} />}
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line type="linear" yAxisId="left" dataKey={value} name={`Required Angle (${unit})`} stroke={color} strokeWidth={3} dot={false} connectNulls={false} isAnimationActive={false} />
            {derivative && <Line 
              type="monotone"
              yAxisId="right" 
              dataKey={derivative} 
              name={`Angle Derivative (${unit}/m)`}
              stroke="#00fff2" 
              strokeWidth={2} 
              strokeDasharray="5 5"
              dot={false} 
              isAnimationActive={false} 
            />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}