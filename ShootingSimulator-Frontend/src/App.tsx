import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import DistanceSweepView from './DistanceSweepView';
import TrajectoryVisualizer, { type SimulationResults } from './TrajectoryVisualizer';

export default function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'sweep'>('simulator');
  const WS_URL = 'ws://localhost:8080';

  // --- Global Connection State ---
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // --- Global Data Store ---
  const [simulatorResults, setSimulatorResults] = useState<SimulationResults>({
    trajectories: [], bestTrajectory: null, bestInfo: null, robustnessData: []
  });
  const [sweepResults, setSweepResults] = useState<any[]>([]);

  // --- Centralized WebSocket Management ---
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Route the incoming data to the correct state based on its type
        if (data.type === 'results') {
          setSimulatorResults({
            trajectories: data.data.trajectories || [],
            bestTrajectory: data.data.bestTrajectory || null,
            bestInfo: data.data.bestInfo || null,
            robustnessData: data.data.robustnessData || []
          });
        } else if (data.type === 'sweepResults') {
          setSweepResults(data.data || []);
        }
      } catch (e) {
        console.error("Failed to parse backend response", e);
      }
    };

    ws.onclose = () => setIsConnected(false);

    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, []); // Only runs once when the app loads

  // Generic function to allow children to send data through the shared socket
  const sendMessage = useCallback((payload: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  return (
    <div className="app-container">
      <header className="app-header">
        <div>
          <h1 className="app-title">REBUILT Target Simulator</h1>
          <p className="app-subtitle">Live trajectory calculation and hardware constraint mapping</p>
        </div>
        
        <div className="tab-container">
          <button 
            onClick={() => setActiveTab('simulator')} 
            className={`btn ${activeTab === 'simulator' ? 'active-orange' : ''}`}
          >
            Live Simulator
          </button>
          <button 
            onClick={() => setActiveTab('sweep')} 
            className={`btn ${activeTab === 'sweep' ? 'active-orange' : ''}`}
          >
            Sweep Graphs
          </button>
        </div>
      </header>
      
      <main className="main-content">
        {activeTab === 'simulator' ? (
          <TrajectoryVisualizer isConnected={isConnected} results={simulatorResults} sendMessage={sendMessage} />
        ) : (
          <DistanceSweepView isConnected={isConnected} sweepData={sweepResults} sendMessage={sendMessage} />
        )}
      </main>
    </div>
  );
}