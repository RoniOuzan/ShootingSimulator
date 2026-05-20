import React, { useState, useRef, useEffect } from "react";
import type { SharedConfig, ObstacleConfig } from "../types";
import "./ObstacleManagingModel.css";

interface Props {
  config: SharedConfig;
  updateConfig: <K extends keyof SharedConfig>(section: K, updates: any) => void;
  onClose: () => void;
}

const GRID_WIDTH_M = 16; 
const GRID_HEIGHT_M = 6;

const DEFAULT_X = -GRID_WIDTH_M + 2;
const DEFAULT_Y = 0;

type DragState = {
  type: "OBSTACLE_CIRCLE" | "OBSTACLE_CIRCLE_RESIZE" | "OBSTACLE_POLYGON" | "OBSTACLE_POLYGON_VERTEX" | "PANNING";
  id?: string;
  startX: number;
  startY: number;
  initialObstacles?: ObstacleConfig[];
  vertexIndex?: number;
  initialPanX?: number;
  initialPanY?: number;
};

export default function ObstacleManagingModel({ config, updateConfig, onClose }: Props) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [panX, setPanX] = useState(DEFAULT_X); 
  const [panY, setPanY] = useState(DEFAULT_Y);
  
  // NEW: Track which obstacle is currently selected
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const svgRef = useRef<SVGSVGElement>(null);

  const targetX = 0;
  const targetY = config.target.targetY;
  const obstacles = config.obstacles || [];

  // --- Keyboard Deletion Listener ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if the user is typing inside an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if ((e.key === "Backspace" || e.key === "Delete") && selectedId) {
        handleRemoveObstacle(selectedId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, obstacles]);

  // --- Handlers for Adding/Removing Obstacles ---
  const handleAddObstacle = (type: "CIRCLE" | "POLYGON") => {
    const id = crypto.randomUUID ? crypto.randomUUID() : `obs_${Date.now()}`;
    const baseName = type === "CIRCLE" ? "Circle" : "Polygon";
    const name = `${baseName} ${obstacles.length + 1}`;
    
    const spawnX = panX + (GRID_WIDTH_M / 2);
    const spawnY = panY + (GRID_HEIGHT_M / 2);

    const newObstacle: ObstacleConfig = type === "CIRCLE"
      ? { type: "CIRCLE", id, name, center: { x: spawnX, y: spawnY }, radius: 1 }
      : { type: "POLYGON", id, name, vertices: [
          {x: spawnX - 1, y: spawnY - 1}, 
          {x: spawnX + 1, y: spawnY - 1}, 
          {x: spawnX, y: spawnY + 1}
        ]};
    
    updateConfig("obstacles", [...obstacles, newObstacle]);
    setSelectedId(id); // Auto-select the newly added obstacle
  };

  const handleRemoveObstacle = (id: string) => {
    updateConfig("obstacles", obstacles.filter(obs => obs.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // --- Drag & Pan Handlers ---
  const handlePointerDownBackground = (e: React.PointerEvent) => {
    if (e.button !== 0) return; 
    setSelectedId(null); // Deselect on background click

    (e.target as Element).setPointerCapture(e.pointerId);
    setDragState({
      type: "PANNING", startX: e.clientX, startY: e.clientY,
      initialPanX: panX, initialPanY: panY,
    });
  };

  const handlePointerDownObstacle = (e: React.PointerEvent, obs: ObstacleConfig) => {
    e.stopPropagation();
    setSelectedId(obs.id); // Select obstacle

    (e.target as Element).setPointerCapture(e.pointerId);
    setDragState({
      type: obs.type === "CIRCLE" ? "OBSTACLE_CIRCLE" : "OBSTACLE_POLYGON",
      id: obs.id, startX: e.clientX, startY: e.clientY,
      initialObstacles: JSON.parse(JSON.stringify(obstacles)),
    });
  };

  const handlePointerDownCircleResize = (e: React.PointerEvent, obs: ObstacleConfig) => {
    e.stopPropagation();
    setSelectedId(obs.id);

    (e.target as Element).setPointerCapture(e.pointerId);
    setDragState({
      type: "OBSTACLE_CIRCLE_RESIZE", id: obs.id, startX: e.clientX, startY: e.clientY,
      initialObstacles: JSON.parse(JSON.stringify(obstacles)),
    });
  };

  const handlePointerDownVertex = (e: React.PointerEvent, obs: ObstacleConfig, vertexIndex: number) => {
    e.stopPropagation();
    setSelectedId(obs.id);

    (e.target as Element).setPointerCapture(e.pointerId);
    setDragState({
      type: "OBSTACLE_POLYGON_VERTEX", id: obs.id, startX: e.clientX, startY: e.clientY,
      initialObstacles: JSON.parse(JSON.stringify(obstacles)), vertexIndex,
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const metersPerPixelX = GRID_WIDTH_M / rect.width;
    const metersPerPixelY = GRID_HEIGHT_M / rect.height;

    const deltaX_m = (e.clientX - dragState.startX) * metersPerPixelX;
    const deltaY_m = -(e.clientY - dragState.startY) * metersPerPixelY;

    if (dragState.type === "PANNING" && dragState.initialPanX !== undefined && dragState.initialPanY !== undefined) {
      setPanX(dragState.initialPanX - deltaX_m);
      setPanY(dragState.initialPanY - deltaY_m);
      return;
    }

    if (dragState.initialObstacles) {
      const updatedObstacles = dragState.initialObstacles.map((obs) => {
        if (obs.id !== dragState.id) return obs;

        if (obs.type === "CIRCLE" && dragState.type === "OBSTACLE_CIRCLE") {
          return { ...obs, center: { x: obs.center.x + deltaX_m, y: obs.center.y + deltaY_m } };
        }
        if (obs.type === "CIRCLE" && dragState.type === "OBSTACLE_CIRCLE_RESIZE") {
          const initialObs = dragState.initialObstacles!.find(o => o.id === dragState.id);
          if (initialObs && initialObs.type === "CIRCLE") {
            const currentHandleX = initialObs.center.x + initialObs.radius + deltaX_m;
            const currentHandleY = initialObs.center.y + deltaY_m;
            const newRadius = Math.hypot(currentHandleX - initialObs.center.x, currentHandleY - initialObs.center.y);
            return { ...obs, radius: Math.max(0.1, newRadius) };
          }
        }
        if (obs.type === "POLYGON" && dragState.type === "OBSTACLE_POLYGON") {
          return { ...obs, vertices: obs.vertices.map((v) => ({ x: v.x + deltaX_m, y: v.y + deltaY_m })) };
        }
        if (obs.type === "POLYGON" && dragState.type === "OBSTACLE_POLYGON_VERTEX" && dragState.vertexIndex !== undefined) {
          const newVertices = [...obs.vertices];
          newVertices[dragState.vertexIndex] = {
            x: newVertices[dragState.vertexIndex].x + deltaX_m,
            y: newVertices[dragState.vertexIndex].y + deltaY_m
          };
          return { ...obs, vertices: newVertices };
        }
        return obs;
      });
      updateConfig("obstacles", updatedObstacles);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragState) {
      (e.target as Element).releasePointerCapture(e.pointerId);
      setDragState(null);
    }
  };

  // --- Manual Input Handlers ---
  const handleUpdateObstacleData = (id: string, updates: Partial<ObstacleConfig>) => {
    const updatedObstacles = obstacles.map((obs) => 
      obs.id === id ? { ...obs, ...updates } : obs
    ) as ObstacleConfig[];
    updateConfig("obstacles", updatedObstacles);
  };

  const handleUpdateVertex = (obsId: string, vIndex: number, axis: 'x' | 'y', val: number) => {
    const obs = obstacles.find(o => o.id === obsId);
    if (!obs || obs.type !== "POLYGON") return;
    const newVertices = [...obs.vertices];
    newVertices[vIndex] = { ...newVertices[vIndex], [axis]: val };
    handleUpdateObstacleData(obsId, { vertices: newVertices });
  };

  const handleAddVertex = (obsId: string) => {
    const obs = obstacles.find(o => o.id === obsId);
    if (!obs || obs.type !== "POLYGON") return;
    const lastV = obs.vertices[obs.vertices.length - 1];
    const newVertices = [...obs.vertices, { x: lastV.x + 0.5, y: lastV.y + 0.5 }];
    handleUpdateObstacleData(obsId, { vertices: newVertices });
  };

  const handleRemoveVertex = (obsId: string, vIndex: number) => {
    const obs = obstacles.find(o => o.id === obsId);
    if (!obs || obs.type !== "POLYGON" || obs.vertices.length <= 3) return; 
    const newVertices = obs.vertices.filter((_, i) => i !== vIndex);
    handleUpdateObstacleData(obsId, { vertices: newVertices });
  };

  // --- Rendering Prep ---
  const gridLines = [];
  const startX = Math.floor(panX) - 5;
  const endX = Math.ceil(panX + GRID_WIDTH_M) + 5;
  const startY = Math.floor(panY) - 5;
  const endY = Math.ceil(panY + GRID_HEIGHT_M) + 5;

  for (let x = startX; x <= endX; x++) gridLines.push(<line key={`vx-${x}`} x1={x} y1={startY} x2={x} y2={endY} stroke="rgba(255,255,255,0.05)" strokeWidth={x % 5 === 0 ? 0.1 : 0.05} />);
  for (let y = startY; y <= endY; y++) gridLines.push(<line key={`hy-${y}`} x1={startX} y1={y} x2={endX} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={y % 5 === 0 ? 0.1 : 0.05} />);

  const viewBoxStr = `${panX} ${panY} ${GRID_WIDTH_M} ${GRID_HEIGHT_M}`;

  return (
    <div className="env-editor-overlay">
      <div className="env-editor-modal">
        <div className="env-editor-header">
          <h2>Obstacle Managing</h2>
          <div className="header-controls">
            <button className="add-btn circle" onClick={() => handleAddObstacle('CIRCLE')}>+ Circle</button>
            <button className="add-btn poly" onClick={() => handleAddObstacle('POLYGON')}>+ Polygon</button>
            <div className="header-divider" />
            <button className="reset-cam-btn" onClick={() => { setPanX(DEFAULT_X); setPanY(DEFAULT_Y); }}>Reset Camera</button>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
        </div>
        
        <div className="env-editor-body">
          {/* Main Canvas Area */}
          <div className="env-editor-canvas-container">
            <svg
              ref={svgRef}
              className={`env-svg ${dragState?.type === 'PANNING' ? 'panning' : ''}`}
              viewBox={viewBoxStr}
              onPointerDown={handlePointerDownBackground}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              style={{ transform: "scale(1, -1)" }}
            >
              {gridLines}

              <line x1={startX} y1={0} x2={endX} y2={0} stroke="rgba(255,255,255,0.3)" strokeWidth={0.08} />
              <line x1={0} y1={startY} x2={0} y2={endY} stroke="rgba(255,255,255,0.3)" strokeWidth={0.08} />
              <circle cx={0} cy={0} r={0.2} fill="rgba(255,255,255,0.5)" />
              <text x={0.3} y={0.3} fill="rgba(255,255,255,0.5)" fontSize={0.4} style={{ transform: "scale(1, -1)" }}>0,0</text>

              <g opacity={0.6}>
                <rect x={targetX - 0.2} y={targetY - 0.2} width={0.4} height={0.4} fill="#15ff00" stroke="#fff" strokeWidth={0.05} />
                <line x1={targetX - 0.4} y1={targetY} x2={targetX + 0.4} y2={targetY} stroke="#fff" strokeWidth={0.05} />
                <line x1={targetX} y1={targetY - 0.4} x2={targetX} y2={targetY + 0.4} stroke="#fff" strokeWidth={0.05} />
              </g>

              {obstacles.map((obs) => {
                const isSelected = selectedId === obs.id;
                const strokeColor = isSelected ? "#3b82f6" : (obs.type === "CIRCLE" ? "#fb923c" : "#ef4444");
                const strokeWidth = isSelected ? 0.08 : 0.05;

                if (obs.type === "CIRCLE") {
                  return (
                    <g key={obs.id}>
                      <circle
                        cx={obs.center.x} cy={obs.center.y} r={obs.radius}
                        fill={isSelected ? "rgba(59, 130, 246, 0.4)" : "rgba(251, 146, 60, 0.4)"} 
                        stroke={strokeColor} strokeWidth={strokeWidth}
                        style={{ cursor: (dragState?.id === obs.id && dragState.type === "OBSTACLE_CIRCLE") ? "grabbing" : "grab" }}
                        onPointerDown={(e) => handlePointerDownObstacle(e, obs)}
                      />
                      <circle
                        cx={obs.center.x + obs.radius} cy={obs.center.y} r={0.15}
                        fill="#fff" stroke={strokeColor} strokeWidth={0.05}
                        style={{ cursor: (dragState?.id === obs.id && dragState.type === "OBSTACLE_CIRCLE_RESIZE") ? "grabbing" : "ew-resize" }}
                        onPointerDown={(e) => handlePointerDownCircleResize(e, obs)}
                      />
                    </g>
                  );
                }

                if (obs.type === "POLYGON") {
                  return (
                    <g key={obs.id}>
                      <polygon
                        points={obs.vertices.map(v => `${v.x},${v.y}`).join(" ")}
                        fill={isSelected ? "rgba(59, 130, 246, 0.4)" : "rgba(239, 68, 68, 0.4)"} 
                        stroke={strokeColor} strokeWidth={strokeWidth}
                        style={{ cursor: (dragState?.id === obs.id && dragState.type === "OBSTACLE_POLYGON") ? "grabbing" : "grab" }}
                        onPointerDown={(e) => handlePointerDownObstacle(e, obs)}
                      />
                      {obs.vertices.map((v, i) => (
                        <circle
                          key={`${obs.id}-v${i}`} cx={v.x} cy={v.y} r={0.15} fill="#fff" stroke={strokeColor} strokeWidth={0.05}
                          style={{ cursor: (dragState?.type === "OBSTACLE_POLYGON_VERTEX" && dragState.id === obs.id && dragState.vertexIndex === i) ? 'grabbing' : 'crosshair' }}
                          onPointerDown={(e) => handlePointerDownVertex(e, obs, i)}
                        />
                      ))}
                    </g>
                  );
                }
                return null;
              })}
            </svg>
            <div className="env-editor-footer">
              <p>ℹ️ <b>Drag background</b> to pan. <b>Drag shapes</b> to move them. Select an obstacle and press <b>Backspace</b> to delete.</p>
            </div>
          </div>

          {/* Properties Sidebar */}
          <div className="env-editor-properties">
            <h3>Properties</h3>
            {obstacles.length === 0 && (
              <p className="no-props">No obstacles. Add one from the top bar.</p>
            )}
            
            {obstacles.map(obs => {
              const isSelected = selectedId === obs.id;
              
              return (
                <div 
                  key={obs.id} 
                  className={`prop-card ${obs.type} ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedId(obs.id)} // Select when clicking the panel
                >
                  <div className="prop-header">
                    <div className="prop-title">
                      <span className="prop-icon">{obs.type === 'CIRCLE' ? '🔴' : '🛑'}</span>
                      <input 
                        className="prop-name-input" 
                        value={obs.name} 
                        onChange={e => handleUpdateObstacleData(obs.id, { name: e.target.value })} 
                      />
                    </div>
                    <button className="del-btn" onClick={(e) => { e.stopPropagation(); handleRemoveObstacle(obs.id); }} title="Delete Obstacle">✕</button>
                  </div>

                  {obs.type === "CIRCLE" && (
                    <div className="prop-body">
                      <div className="number-row">
                        <div className="num-box">
                          <label>Center X</label>
                          <input type="number" step="0.1" value={Number(obs.center.x.toFixed(2))} onChange={e => handleUpdateObstacleData(obs.id, { center: { ...obs.center, x: parseFloat(e.target.value) || 0 }})} />
                        </div>
                        <div className="num-box">
                          <label>Center Y</label>
                          <input type="number" step="0.1" value={Number(obs.center.y.toFixed(2))} onChange={e => handleUpdateObstacleData(obs.id, { center: { ...obs.center, y: parseFloat(e.target.value) || 0 }})} />
                        </div>
                      </div>
                      <div className="number-row full">
                        <div className="num-box full">
                          <label>Radius (m)</label>
                          <input type="number" step="0.1" min="0.1" value={Number(obs.radius.toFixed(2))} onChange={e => handleUpdateObstacleData(obs.id, { radius: Math.max(0.1, parseFloat(e.target.value) || 0.1) })} />
                        </div>
                      </div>
                    </div>
                  )}

                  {obs.type === "POLYGON" && (
                    <div className="prop-body">
                      <div className="poly-vertex-list">
                        {obs.vertices.map((v, i) => (
                          <div key={i} className="vertex-row">
                            <span className="v-label">V{i + 1}</span>
                            <div className="num-box mini">
                              <label>X</label>
                              <input type="number" step="0.1" value={Number(v.x.toFixed(2))} onChange={e => handleUpdateVertex(obs.id, i, 'x', parseFloat(e.target.value) || 0)} />
                            </div>
                            <div className="num-box mini">
                              <label>Y</label>
                              <input type="number" step="0.1" value={Number(v.y.toFixed(2))} onChange={e => handleUpdateVertex(obs.id, i, 'y', parseFloat(e.target.value) || 0)} />
                            </div>
                            {obs.vertices.length > 3 && (
                              <button className="del-v-btn" onClick={(e) => { e.stopPropagation(); handleRemoveVertex(obs.id, i); }} title="Remove vertex">-</button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button className="add-v-btn" onClick={(e) => { e.stopPropagation(); handleAddVertex(obs.id); }}>+ Add Vertex</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}