import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import DistanceSweepView from "./sweep/DistanceSweepView";
import TrajectoryVisualizer, {
  type SimulationResults,
} from "./visualizer/TrajectoryVisualizer";
import SurfaceSweepView from "./surface/SurfaceSweepView";

export type TargetMode = "VERTICAL" | "HORIZONTAL";

export default function App() {
  const WS_URL = "ws://localhost:8080";
  const [activeTab, setActiveTab] = useState<"simulator" | "sweep" | "surface">(
    "simulator",
  );

  // --- Global Target Mode ---
  const [targetMode, setTargetMode] = useState<TargetMode>("VERTICAL");

  // --- Global Connection State ---
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // --- Global Data Store ---
  const [simulatorResults, setSimulatorResults] = useState<SimulationResults>({
    trajectories: [],
    bestTrajectory: null,
    bestInfo: null,
    robustnessData: [],
    costData: [],
  });
  const [sweepResults, setSweepResults] = useState<any[]>([]);
  const [surfaceResults, setSurfaceResults] = useState<any>({});

  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [calcTime, setCalcTime] = useState<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // --- Centralized WebSocket Management ---
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current?.readyState == WebSocket.OPEN) setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        const duration = Math.round(performance.now() - startTimeRef.current);
        setIsCalculating((prev) => {
          if (prev) {
            setCalcTime(duration);
          }
          return false; // Always set to false once a message arrives
        });

        // Route the incoming data to the correct state based on its type
        if (data.type === "results") {
          setSimulatorResults({
            trajectories: data.data.trajectories || [],
            bestTrajectory: data.data.bestTrajectory || null,
            bestInfo: data.data.bestInfo || null,
            robustnessData: data.data.robustnessData || [],
            costData: data.data.costData || [],
          });
        } else if (data.type === "sweepResults") {
          setSweepResults(data.data || []);
        } else if (data.type === "surfaceResults") {
          setSurfaceResults(data.data || {});
        }
      } catch (e) {
        console.error("Failed to parse backend response", e);
      }
    };

    ws.onclose = () => setIsConnected(false);

    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, []);

  // Generic function to allow children to send data through the shared socket
  const sendMessage = useCallback((payload: any, showTime: boolean = false) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));

      if (showTime) {
        setIsCalculating(true);
        startTimeRef.current = performance.now();
      }
    }
  }, []);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">REBUILT Target Simulator</h1>
          <p className="app-subtitle">
            Live trajectory calculation and hardware constraint mapping
          </p>
        </div>

        {/* Global Target Mode Toggle */}
        <div className="target-mode-container">
          <span className="mode-label">Target Type:</span>
          <div className="mode-toggle">
            <button
              onClick={() => setTargetMode("VERTICAL")}
              className={`btn-toggle ${targetMode === "VERTICAL" ? "active-mode" : ""}`}
            >
              Vertical
            </button>
            <button
              onClick={() => setTargetMode("HORIZONTAL")}
              className={`btn-toggle ${targetMode === "HORIZONTAL" ? "active-mode" : ""}`}
            >
              Horizontal
            </button>
          </div>
        </div>

        <div className="tab-container">
          <button
            onClick={() => setActiveTab("simulator")}
            className={`btn ${activeTab === "simulator" ? "active-orange" : ""}`}
          >
            Live Simulator
          </button>
          <button
            onClick={() => setActiveTab("sweep")}
            className={`btn ${activeTab === "sweep" ? "active-orange" : ""}`}
          >
            Sweep Graphs
          </button>
          <button
            onClick={() => setActiveTab("surface")}
            className={`btn ${activeTab === "surface" ? "active-orange" : ""}`}
          >
            3D Surface Maps
          </button>
        </div>
      </header>

      <main className="main-content">
        <div className="content-wrapper">
          {!isCalculating && calcTime !== null && (
            <div className="calc-stats">
              Finished in <strong>{calcTime}ms</strong>
            </div>
          )}
          
          {/* Pass targetMode down to all child views */}
          {activeTab === "simulator" && (
            <TrajectoryVisualizer
              isConnected={isConnected}
              results={simulatorResults}
              sendMessage={sendMessage}
              targetMode={targetMode} 
            />
          )}
          {activeTab === "sweep" && (
            <DistanceSweepView
              isConnected={isConnected}
              sweepData={sweepResults}
              sendMessage={sendMessage}
              targetMode={targetMode}
            />
          )}
          {activeTab === "surface" && (
            <SurfaceSweepView
              isConnected={isConnected}
              surfaceData={surfaceResults}
              sendMessage={sendMessage}
              targetMode={targetMode}
            />
          )}
        </div>
      </main>

      {/* Absolute-positioned components */}
      {/* {isCalculating && (
        <div className="calc-overlay">
          <div className="spinner"></div>
          <p>Calculating optimized trajectory...</p>
        </div>
      )} */}
    </div>
  );
}