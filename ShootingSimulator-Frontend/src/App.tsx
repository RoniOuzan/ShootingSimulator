import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import DistanceSweepView from "./sweep/DistanceSweepView";
import TrajectoryVisualizer from "./visualizer/TrajectoryVisualizer";
import SurfaceSweepView from "./surface/SurfaceSweepView";
import SharedConfigSidebar from "./components/SharedConfigSidebar";
import { usePersistedState } from "./hooks/usePersistedState";
import type { SharedConfig, SimulationResults } from "./types";

const DEFAULT_CONFIG: SharedConfig = {
  origin: {
    initialY: 0,
    radialVelocity: 0,
  },
  target: {
    targetY: 2.0,
    minHitAngle: -90,
    maxHitAngle: -30,
    targetAxis: "HORIZONTAL",
  },
  aerodynamics: {
    mass: 0.22,
    diameter: 0.075,
    dragCoeff: 0.5,
    spinRPSPerMS: 1,
    magnusCoeff: 0.5,
  },
  hardware: {
    minAngle: 50,
    maxAngle: 90,
    minVel: 6,
    maxVel: 12,
    estimatedAngleError: 0.05,
    estimatedVelocityError: 0.008,
  },
  cost: {
    preset: "BALANCED",
    robustnessWeight: 1.0,
    initialVelocityWeight: 0.05,
    impactVelocityWeight: 0.1,
    timeOfFlightWeight: 0.5,
    entryAngleWeight: 0.2,
    targetImpactAngle: -50,
  },
  obstacles: [],
};

export default function App() {
  const WS_URL = "ws://localhost:8080";

  const [activeTab, setActiveTab] = usePersistedState<
    "simulator" | "sweep" | "surface"
  >("activeTab", "simulator");
  const [sidebarCollapsed, setSidebarCollapsed] = usePersistedState(
    "sidebarCollapsed",
    false,
  );

  // Shared configuration with persistence
  const [sharedConfig, setSharedConfig] = usePersistedState<SharedConfig>(
    "sharedConfig",
    DEFAULT_CONFIG,
  );

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Data stores
  const [simulatorResults, setSimulatorResults] = useState<SimulationResults>({
    trajectories: [],
    bestTrajectory: null,
    bestInfo: null,
    robustnessData: [],
    costData: [],
  });
  const [sweepResults, setSweepResults] = useState<any[]>([]);
  const [surfaceResults, setSurfaceResults] = useState<any>({});

  // Calculation state
  const [isCalculating, setIsCalculating] = useState(false);
  const [calcProgress, setCalcProgress] = useState(0);
  const [eta, setEta] = useState(0);
  const [calcTime, setCalcTime] = useState<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // WebSocket management
  useEffect(() => {
    if (wsRef.current) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // Handle progress updates
        if (message.type === "progress") {
          setCalcProgress(message.data.progress || 0);
          setEta(message.data.eta);
          return;
        }

        const duration = Math.round(performance.now() - startTimeRef.current);
        setIsCalculating(false);
        setCalcProgress(0);
        setCalcTime(duration);

        if (message.type === "results") {
          setSimulatorResults({
            trajectories: message.data.trajectories || [],
            bestTrajectory: message.data.bestTrajectory || null,
            bestInfo: message.data.bestInfo || null,
            robustnessData: message.data.robustnessData || [],
            costData: message.data.costData || [],
          });
        } else if (message.type === "sweepResults") {
          setSweepResults(message.data || []);
        } else if (message.type === "surfaceResults") {
          setSurfaceResults(message.data || {});
        }
      } catch (e) {
        console.error("Failed to parse backend response", e);
        setIsCalculating(false);
      }
    };

    ws.onclose = () => setIsConnected(false);
    ws.onerror = () => setIsCalculating(false);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const sendMessage = useCallback((payload: any, showTime = false) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));

      if (showTime) {
        setIsCalculating(true);
        setCalcProgress(0);
        startTimeRef.current = performance.now();
      }
    }
  }, []);

  // Update shared config helper
  const updateConfig = useCallback(
  <K extends keyof SharedConfig>(
    section: K,
    updates: Partial<SharedConfig[K]> | SharedConfig[K], // Allow direct assignment
  ) => {
    setSharedConfig((prev) => {
      if (section === "obstacles") {
        return {
          ...prev,
          [section]: updates,
        };
      }
      return {
        ...prev,
        [section]: { ...(prev[section] as any), ...updates },
      };
    });
  },
  [setSharedConfig],
);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">Shooting Simulator</h1>
          <p className="app-subtitle">
            Live trajectory calculation and hardware constraint mapping
          </p>
        </div>

        {/* Target Mode Toggle */}

        {/* Tab Navigation */}
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

      <div className="app-body">
        {/* Shared Configuration Sidebar */}
        <SharedConfigSidebar
          config={sharedConfig}
          updateConfig={updateConfig}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Main Content */}
        <main className="main-content">
          <div className="content-wrapper">
            {!isCalculating && calcTime !== null && (
              <div className="calc-stats">
                Finished in <strong>{calcTime}ms</strong>
              </div>
            )}

            {activeTab === "simulator" && (
              <TrajectoryVisualizer
                isConnected={isConnected}
                results={simulatorResults}
                sendMessage={sendMessage}
                sharedConfig={sharedConfig}
                updateConfig={updateConfig}
              />
            )}
            {activeTab === "sweep" && (
              <DistanceSweepView
                isConnected={isConnected}
                sweepData={sweepResults}
                sendMessage={sendMessage}
                sharedConfig={sharedConfig}
                isCalculating={isCalculating}
                calcProgress={calcProgress}
                eta={eta}
              />
            )}
            {activeTab === "surface" && (
              <SurfaceSweepView
                isConnected={isConnected}
                surfaceData={surfaceResults}
                sendMessage={sendMessage}
                sharedConfig={sharedConfig}
                isCalculating={isCalculating}
                calcProgress={calcProgress}
                eta={eta}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
