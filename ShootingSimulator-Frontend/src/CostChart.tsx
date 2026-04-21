import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Add minAngle and maxAngle to the interface
interface CostChartProps {
  data: any[];
  minAngle: number;
  maxAngle: number;
}

// Destructure the new props
export default function CostChart({
  data,
  minAngle,
  maxAngle,
}: CostChartProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{ color: "#888", padding: "20px", textAlign: "center" }}>
        Awaiting simulation data...
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            background: "#1c1c22",
            border: "1px solid #333",
            padding: "10px",
            borderRadius: "6px",
            color: "#fff",
            fontSize: "0.85rem",
          }}
        >
          <p
            style={{
              margin: "0 0 8px 0",
              fontWeight: "bold",
              borderBottom: "1px solid #333",
              paddingBottom: "4px",
            }}
          >
            Angle: {label}°{" "}
            <span
              style={{ color: "#888", fontWeight: "normal", marginLeft: "8px" }}
            >
              (Req Vel: {payload[0].payload.vReq} m/s)
            </span>
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} style={{ color: entry.color, margin: "2px 0" }}>
              {entry.name}: {entry.value !== null && entry.value !== undefined ? entry.value : "N/A"}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "250px" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" vertical={false} />
          
          <XAxis 
            dataKey="x" stroke="#888" type="number" 
            domain={[minAngle, maxAngle]} tickCount={10} 
          />

          <YAxis yAxisId="left" stroke="#888" orientation="left" />
          
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: "12px" }} />

          <Line yAxisId="left" type="linear" dataKey="y" name="cost" stroke="#ff4444" strokeWidth={2} dot={true} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
