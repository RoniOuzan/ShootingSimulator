import { useEffect, useRef, useState } from 'react';
import DistanceSweepCharts from './DistanceSweepCharts';

// --- Props Interface ---
interface DistanceSweepViewProps {
  isConnected: boolean;
  sweepData: any[];
  sendMessage: (payload: any, showTime?: boolean) => void;
}

export default function DistanceSweepView({ isConnected, sweepData, sendMessage }: DistanceSweepViewProps) {
  // --- Shared Simulation Constants ---
  const [targetY, setTargetY] = useState<number>(2.0);
  const [radialVelocity, setRadialVelocity] = useState<number>(2);
  const initialY = 0.0; // Height of the shooter
  const tolY = 0.01; // Target Y tolerance
  const tolX = 0.03; // Target Y tolerance
  const minHitAngle = -90;
  const maxHitAngle = -30;

  // --- Hardware Limits State ---
  const [minAngle, setMinAngle] = useState<number>(50);
  const [maxAngle, setMaxAngle] = useState<number>(80);
  const [minVel, setMinVel] = useState<number>(6);
  const [maxVel, setMaxVel] = useState<number>(12);
  const [estimatedAngleError, setEstimatedAngleError] = useState<number>(0.5);
  const [estimatedVelocityError, setEstimatedVelocityError] = useState<number>(0.08);

  // --- Aerodynamic Parameters State ---
  const [mass, setMass] = useState<number>(0.22); // kg
  const [diameter, setDiameter] = useState<number>(0.075); // meters
  const [dragCoeff, setDragCoeff] = useState<number>(0.5); 
  const [spinRPSPerMS, setSpinRPSPerMS] = useState<number>(1); // Positive = Backspin
  const [magnusCoeff, setMagnusCoeff] = useState<number>(0.5); 

  // --- Throttled Calculation Sender ---
  const lastSendTime = useRef<number>(0);
  const sendTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isConnected) return; // Wait until App.tsx confirms the connection is open

    // The payload type is "sweep" to trigger the LUT generation loop on the backend
    const payload = {
      type: 'sweep', 
      data: { 
        initialY, radialVelocity, targetY, tolX, tolY, minHitAngle, maxHitAngle, 
        physicalValues: {
          minAngle, maxAngle, minVel, maxVel, estimatedAngleError, estimatedVelocityError,
          mass, diameter, dragCoeff, spinRPSPerMS, magnusCoeff
        } 
      }
    };

    const now = Date.now();
    const COOLDOWN_MS = 200; // 5Hz update rate prevents overwhelming the charts

    if (now - lastSendTime.current > COOLDOWN_MS) {
      sendMessage(payload, true);
      lastSendTime.current = now;
      if (sendTimeout.current) clearTimeout(sendTimeout.current);
    } else {
      if (sendTimeout.current) clearTimeout(sendTimeout.current);
      sendTimeout.current = setTimeout(() => {
        sendMessage(payload, true);
        lastSendTime.current = Date.now();
      }, COOLDOWN_MS - (now - lastSendTime.current));
    }
  }, [
    isConnected, sendMessage, 
    targetY, radialVelocity, minAngle, maxAngle, minVel, maxVel, estimatedAngleError, estimatedVelocityError,
    mass, diameter, dragCoeff, spinRPSPerMS, magnusCoeff
  ]);

  return (
    <div className="main-content"> {/* Reuses the main-content flex layout */}
      
      {/* Charts Area */}
      <div className="charts-area">
        <div className="status-indicator">
          <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
          <span className="status-text">
            {isConnected ? 'Solver Linked' : 'Awaiting Connection...'}
          </span>
        </div>
        
        <div style={{ flexGrow: 1, minHeight: 0 }}>
          <DistanceSweepCharts data={sweepData} />
        </div>
      </div>

      {/* Settings Sidebar */}
      <div className="sidebar">
        <h2 className="card-title" style={{ fontSize: '1.4rem' }}>Robot & Environment</h2>
        
        <div className="card">
          <h3 className="card-title">Targeting</h3>
          <ControlSlider label="Radial Velocity" value={radialVelocity} min={-4.0} max={4.0} step={0.1} unit="ms" onChange={setRadialVelocity} />
          <ControlSlider label="Target Height (Y)" value={targetY} min={0.5} max={4.0} step={0.05} unit="m" onChange={setTargetY} />
        </div>

        <div className="card">
          <h3 className="card-title">Aerodynamics</h3>
          <div className="card-row">
            <ControlSlider label="Mass" value={mass} min={0.05} max={1.0} step={0.01} unit="kg" onChange={setMass} />
            <ControlSlider label="Diameter" value={diameter} min={0.05} max={0.5} step={0.01} unit="m" onChange={setDiameter} />
          </div>
          
          <div className="card-divider card-row">
            <ControlSlider label="Spin (RPS/ms)" value={spinRPSPerMS} min={-2} max={2} step={0.1} unit=" rps/ms" onChange={setSpinRPSPerMS} />
            <ControlSlider label="Magnus Coeff" value={magnusCoeff} min={0.0} max={1.0} step={0.05} unit=" Cm" onChange={setMagnusCoeff} />
          </div>
        </div>

        {/* Hardware Constraints */}
        <div style={{ background: '#1c1c22', padding: '15px', borderRadius: '8px', border: '1px solid #2a2a35' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: '#fff' }}>Hardware Limits</h3>
          
          <div style={{ display: 'flex', gap: '15px' }}>
            <ControlSlider label="Min Angle" value={minAngle} min={20} max={maxAngle} step={1} unit="°" onChange={setMinAngle} />
            <ControlSlider label="Max Angle" value={maxAngle} min={minAngle} max={85} step={1} unit="°" onChange={setMaxAngle} />
          </div>

          <div style={{ display: 'flex', gap: '15px' }}>
            <ControlSlider label="Drag Coeff" value={dragCoeff} min={0.1} max={2.0} step={0.05} unit=" Cd" onChange={setDragCoeff} />
          </div>
          
          <div style={{ display: 'flex', gap: '15px' }}>
            <ControlSlider label="Min Vel" value={minVel} min={0} max={maxVel} step={0.5} unit="m/s" onChange={setMinVel} />
            <ControlSlider label="Max Vel" value={maxVel} min={minVel} max={30} step={0.5} unit="m/s" onChange={setMaxVel} />
          </div>
          
          <div style={{ borderTop: '1px solid #333', margin: '15px 0', paddingTop: '15px' }}>
            <div style={{ display: 'flex', gap: '15px' }}>
              <ControlSlider label="Angle Error" value={estimatedAngleError} min={0} max={0.5} step={0.02} unit="°" onChange={setEstimatedAngleError} />
              <ControlSlider label="Vel Error" value={estimatedVelocityError} min={0} max={0.5} step={0.02} unit="m/s" onChange={setEstimatedVelocityError} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// --- Reusable UI Sub-Component ---
interface ControlSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (val: number) => void;
  disabled?: boolean;
}

function ControlSlider({ label, value, min, max, step, unit, onChange, disabled = false }: ControlSliderProps) {
  return (
    <div className={`slider-wrapper ${disabled ? 'disabled' : ''}`}>
      <div className="slider-header">
        <span>{label}</span>
        <span className="slider-value">{value}{unit}</span>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step} 
        value={value} 
        onChange={(e) => onChange(Number(e.target.value))} 
        disabled={disabled}
      />
    </div>
  );
}