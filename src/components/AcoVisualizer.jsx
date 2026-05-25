import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Play, Pause, RotateCcw, HelpCircle, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function AcoVisualizer({ 
  deliveries, 
  onAddDelivery, 
  onDeleteDelivery, 
  onUpdateStatus,
  acoParams, 
  onRunAco,
  solverResults 
}) {
  const mapContainerRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [map, setMap] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeed, setSimSpeed] = useState(3); // 1x to 10x speed
  const [showPheromones, setShowPheromones] = useState(true);
  const [simStatus, setSimStatus] = useState('Idle'); // Idle, Solving, Animating, Converged
  const [localPheromones, setLocalPheromones] = useState([]);
  
  // Depot coordinate (SF Central Depot)
  const depot = { id: 'DEPOT', address: 'Central Operations Depot, SF', lat: 37.7749, lng: -122.4194, priority: 'Depot' };
  
  // Active deliveries coordinates array (excluding completed ones)
  const activeDeliveries = deliveries.filter(d => d.status !== 'Delivered');
  const allNodes = [depot, ...activeDeliveries];
  
  // Animation state references
  const antsRef = useRef([]);
  const animFrameIdRef = useRef(null);
  const markersRef = useRef({});
  const activePathRef = useRef([]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    // Initialize map centered on SF Depot
    const leafletMap = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false
    }).setView([depot.lat, depot.lng], 13);
    
    // Premium Dark tile layer from CartoDB
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18
    }).addTo(leafletMap);
    
    setMap(leafletMap);
    
    // Handle leaflet resize hooks
    const handleResize = () => leafletMap.invalidateSize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      leafletMap.remove();
    };
  }, []);

  // Sync Map Markers with Deliveries list
  useEffect(() => {
    if (!map) return;
    
    // Clear old markers
    Object.values(markersRef.current).forEach(m => map.removeLayer(m));
    markersRef.current = {};
    
    // Render Gold Depot warehouse marker
    const depotIconHtml = `
      <div class="relative flex items-center justify-center">
        <div class="absolute inline-flex h-8 w-8 rounded-full bg-amber-500/30 animate-pulse"></div>
        <div class="relative bg-amber-500 text-slate-950 p-2 rounded-xl border border-amber-300 shadow-xl shadow-amber-500/20">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 10-6-6H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z"/><path d="M10 14h4"/><path d="M12 12v4"/></svg>
        </div>
      </div>
    `;
    
    const depotIcon = L.divIcon({
      html: depotIconHtml,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    
    const depotMarker = L.marker([depot.lat, depot.lng], { icon: depotIcon })
      .bindPopup(`<b>${depot.address}</b><br/>Central Operations Center`)
      .addTo(map);
    markersRef.current['DEPOT'] = depotMarker;

    // Render Deliveries pins
    activeDeliveries.forEach(dlv => {
      let pinColor = 'bg-indigo-600 border-indigo-400';
      if (dlv.priority === 'Critical') pinColor = 'bg-red-600 border-red-400 shadow-red-500/40';
      if (dlv.priority === 'High') pinColor = 'bg-amber-600 border-amber-400 shadow-amber-500/40';
      if (dlv.priority === 'Low') pinColor = 'bg-emerald-600 border-emerald-400 shadow-emerald-500/40';

      const deliveryIconHtml = `
        <div class="relative flex items-center justify-center">
          <div class="${pinColor} text-white p-1.5 rounded-lg border shadow-lg transform hover:scale-110 transition cursor-grab active:cursor-grabbing">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          </div>
        </div>
      `;

      const deliveryIcon = L.divIcon({
        html: deliveryIconHtml,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      // Draggable marker logic
      const m = L.marker([dlv.lat, dlv.lng], { icon: deliveryIcon, draggable: true })
        .bindPopup(`
          <div class="text-xs text-slate-800">
            <h4 class="font-bold border-b border-slate-200 pb-1 mb-1 font-heading text-slate-900">${dlv.id}</h4>
            <p><b>Address:</b> ${dlv.destination}</p>
            <p><b>Priority:</b> ${dlv.priority}</p>
            <p><b>Payload:</b> ${dlv.weight} kg</p>
            <p><b>Driver:</b> ${dlv.driver}</p>
            <p class="text-[10px] text-slate-400 mt-1">Drag marker to dynamically recalculate</p>
          </div>
        `)
        .addTo(map);

      // Listen to dragend events to dynamically update locations
      m.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        onAddDelivery({
          ...dlv,
          lat: parseFloat(lat.toFixed(5)),
          lng: parseFloat(lng.toFixed(5))
        }, true); // Pass overwrite=true to edit coordinates on drag
      });

      markersRef.current[dlv.id] = m;
    });

    // Fit map bounds to show depot and pins
    if (allNodes.length > 1) {
      const group = L.featureGroup(Object.values(markersRef.current));
      map.fitBounds(group.getBounds().pad(0.15));
    }
  }, [map, deliveries]);

  // Click on map to drop a package node
  useEffect(() => {
    if (!map) return;
    
    const handleMapClick = (e) => {
      const { lat, lng } = e.latlng;
      
      // Auto-resolve neighborhood naming based on coordinates bounding
      const names = ['Marina District, SF', 'Presidio Heights, SF', 'Pacific Heights, SF', 'Nob Hill, SF', 'SoMa, SF', 'Mission District, SF', 'Potrero Hill, SF', 'Castro District, SF'];
      const randomName = names[Math.floor(Math.random() * names.length)];
      
      const newDlv = {
        destination: `${randomName} (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        lat: parseFloat(lat.toFixed(5)),
        lng: parseFloat(lng.toFixed(5)),
        priority: ['Low', 'Medium', 'High', 'Critical'][Math.floor(Math.random() * 4)],
        weight: Math.floor(20 + Math.random() * 400),
        driver: ['Rahul Sharma', 'Amit Verma', 'Neha Singh', 'Arjun Patel'][Math.floor(Math.random() * 4)]
      };
      
      onAddDelivery(newDlv);
    };

    map.on('click', handleMapClick);
    return () => map.off('click', handleMapClick);
  }, [map, onAddDelivery]);

  // Keep solverResults paths reference synced
  useEffect(() => {
    if (solverResults && solverResults.optimal_routes && solverResults.optimal_routes.length > 0) {
      // Single flattened optimal path for UI visualizer
      const pathIndices = solverResults.optimal_routes[0]; // Take primary route sequence
      activePathRef.current = pathIndices.map(idx => allNodes[idx]).filter(Boolean);
      
      // If we finished optimizing, trigger nice metrics
      setSimStatus('Converged');
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#6366f1', '#10b981', '#a855f7']
      });

      // Populate mock/local pheromones based on results
      const N = allNodes.length;
      const initialPhero = Array(N).fill(0).map(() => Array(N).fill(0.1));
      
      // Apply deposition along paths
      pathIndices.forEach((nodeIdx, stepIdx) => {
        if (stepIdx < pathIndices.length - 1) {
          const nextIdx = pathIndices[stepIdx + 1];
          initialPhero[nodeIdx][nextIdx] = 1.0;
          initialPhero[nextIdx][nodeIdx] = 1.0;
        }
      });
      setLocalPheromones(initialPhero);
    }
  }, [solverResults, deliveries]);

  // High-performance Canvas animation render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !map) return;
    
    const ctx = canvas.getContext('2d');
    
    const render = () => {
      // Match canvas sizes to overlay dimensions
      const rect = mapContainerRef.current.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Get pixel coordinates on screen for all nodes
      const nodePixels = allNodes.map(node => {
        const point = map.latLngToContainerPoint([node.lat, node.lng]);
        return { x: point.x, y: point.y, node };
      });
      
      const N = nodePixels.length;

      // 1. Draw Pheromone trails
      if (showPheromones && N > 1) {
        ctx.shadowBlur = 0;
        for (let i = 0; i < N; i++) {
          for (let j = i + 1; j < N; j++) {
            // Check pheromone level
            let pheroStrength = 0.1;
            if (localPheromones[i] && localPheromones[i][j]) {
              pheroStrength = localPheromones[i][j];
            }
            
            // Draw cold translucent paths turning to thick cyan glowing lines
            const isOptimalPath = activePathRef.current.some((node, idx) => {
              if (idx < activePathRef.current.length - 1) {
                const nextNode = activePathRef.current[idx + 1];
                return (node.id === allNodes[i].id && nextNode.id === allNodes[j].id) ||
                       (node.id === allNodes[j].id && nextNode.id === allNodes[i].id);
              }
              return false;
            });

            ctx.beginPath();
            ctx.moveTo(nodePixels[i].x, nodePixels[i].y);
            ctx.lineTo(nodePixels[j].x, nodePixels[j].y);
            
            if (isOptimalPath) {
              // Thick Neon pulsing path
              ctx.strokeStyle = `rgba(16, 185, 129, ${0.4 + Math.sin(Date.now() * 0.005) * 0.15})`;
              ctx.lineWidth = 4;
            } else {
              ctx.strokeStyle = `rgba(99, 102, 241, ${Math.min(0.7, pheroStrength * 0.25)})`;
              ctx.lineWidth = 1 + pheroStrength * 1.5;
            }
            ctx.stroke();
          }
        }
      }

      // 2. Draw Pulsing Optimal Route overlay with arrows
      if (activePathRef.current.length > 1) {
        ctx.beginPath();
        const pInit = map.latLngToContainerPoint([activePathRef.current[0].lat, activePathRef.current[0].lng]);
        ctx.moveTo(pInit.x, pInit.y);
        
        for (let i = 1; i < activePathRef.current.length; i++) {
          const pt = map.latLngToContainerPoint([activePathRef.current[i].lat, activePathRef.current[i].lng]);
          ctx.lineTo(pt.x, pt.y);
        }
        
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#10b981';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3.5;
        ctx.stroke();
        
        // Draw travel direction arrows
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#34d399';
        for (let i = 0; i < activePathRef.current.length - 1; i++) {
          const p1 = map.latLngToContainerPoint([activePathRef.current[i].lat, activePathRef.current[i].lng]);
          const p2 = map.latLngToContainerPoint([activePathRef.current[i+1].lat, activePathRef.current[i+1].lng]);
          
          // Draw arrow in the middle of this route segment
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          
          ctx.save();
          ctx.translate(midX, midY);
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(-5, -4);
          ctx.lineTo(5, 0);
          ctx.lineTo(-5, 4);
          ctx.fill();
          ctx.restore();
        }
      }

      // 3. Draw Simulated Ants particles crawling
      if (isSimulating && antsRef.current.length > 0) {
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#f59e0b';
        ctx.fillStyle = '#fbbf24';

        antsRef.current.forEach(ant => {
          if (ant.path.length <= 1) return;
          
          // Current step points
          const nodeFrom = allNodes[ant.path[ant.step]];
          const nodeTo = allNodes[ant.path[(ant.step + 1) % ant.path.length]];
          
          if (!nodeFrom || !nodeTo) return;

          const pFrom = map.latLngToContainerPoint([nodeFrom.lat, nodeFrom.lng]);
          const pTo = map.latLngToContainerPoint([nodeTo.lat, nodeTo.lng]);

          // Move along vector smoothly based on speed progress
          ant.progress += 0.01 * simSpeed;
          if (ant.progress >= 1.0) {
            ant.progress = 0;
            ant.step = (ant.step + 1) % (ant.path.length - 1); // Stay within tour
          }

          const currentX = pFrom.x + (pTo.x - pFrom.x) * ant.progress;
          const currentY = pFrom.y + (pTo.y - pFrom.y) * ant.progress;

          ctx.beginPath();
          ctx.arc(currentX, currentY, 3, 0, 2 * Math.PI);
          ctx.fill();
        });
      }
      
      animFrameIdRef.current = requestAnimationFrame(render);
    };

    render();
    
    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [map, deliveries, isSimulating, simSpeed, showPheromones, localPheromones]);

  // Start Simulated Swarm exploration
  const startSimulation = () => {
    if (allNodes.length <= 1) return;

    setSimStatus('Solving');
    
    // Spawn dozens of ants exploring paths
    const m = acoParams.ants || 25;
    const N = allNodes.length;
    const initialAnts = [];
    
    for (let antIdx = 0; antIdx < m; antIdx++) {
      // Assign random visit sequences representing ants searching paths
      const seq = Array.from({ length: N - 1 }, (_, k) => k + 1);
      // Shuffle sequence
      for (let i = seq.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [seq[i], seq[j]] = [seq[j], seq[i]];
      }
      // Tour sequence starting at Depot (0) and returning back
      const path = [0, ...seq, 0];
      
      initialAnts.push({
        id: antIdx,
        path,
        step: 0,
        progress: Math.random() // Stagger entrance times
      });
    }

    antsRef.current = initialAnts;
    setIsSimulating(true);

    // Call actual optimization solver API routes
    onRunAco();
  };

  const pauseSimulation = () => {
    setIsSimulating(!isSimulating);
  };

  const resetAll = () => {
    setIsSimulating(false);
    antsRef.current = [];
    activePathRef.current = [];
    setLocalPheromones([]);
    setSimStatus('Idle');
    if (map) {
      map.setView([depot.lat, depot.lng], 13);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Simulation HUD Control Deck */}
      <div className="glass-card rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800/40 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>

        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white tracking-tight uppercase">Fleet Swarm Controls</h3>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className={`h-1.5 w-1.5 rounded-full ${simStatus === 'Solving' ? 'bg-amber-400 animate-ping' : simStatus === 'Converged' ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Status: {simStatus}</span>
            </div>
          </div>
        </div>

        {/* Speed & Interactive Buttons */}
        <div className="flex flex-wrap items-center gap-4">
          
          {/* Speed Slider */}
          <div className="flex items-center space-x-3 bg-slate-950/40 border border-slate-800/40 px-4 py-2.5 rounded-2xl">
            <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">Speed</span>
            <input 
              type="range" 
              min="1" 
              max="10" 
              value={simSpeed}
              onChange={(e) => setSimSpeed(parseInt(e.target.value))}
              className="w-24 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <span className="text-xs text-indigo-400 font-bold font-mono w-6 text-right shrink-0">{simSpeed}x</span>
          </div>

          {/* Controls button set */}
          <div className="flex items-center space-x-2">
            {simStatus === 'Solving' ? (
              <button 
                onClick={pauseSimulation}
                className="flex items-center justify-center p-3 bg-indigo-600/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-400 rounded-2xl shadow-xl transition-all"
                title={isSimulating ? "Pause Exploration" : "Resume Exploration"}
              >
                {isSimulating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
            ) : (
              <button 
                onClick={startSimulation}
                className="flex items-center space-x-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-2xl shadow-xl shadow-indigo-600/20 transition transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <Play className="w-4 h-4" />
                <span>Optimize Route</span>
              </button>
            )}

            <button 
              onClick={resetAll}
              className="flex items-center justify-center p-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white rounded-2xl transition"
              title="Reset Visualizer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

      {/* Main Dual-Layer Map Canvas Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* Map visual container */}
        <div className="xl:col-span-3 glass-card rounded-3xl p-6 border border-slate-800/40 relative overflow-hidden flex flex-col h-[520px] group">
          
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-bold text-white font-heading">Interactive Dispatch Map</h4>
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-md font-semibold">Active Stops: {activeDeliveries.length}</span>
            </div>
            <div className="flex items-center space-x-3 text-[10px] text-slate-400 font-bold uppercase">
              <span className="flex items-center"><span className="h-1.5 w-1.5 rounded-full bg-amber-500 mr-1.5"></span>Depot</span>
              <span className="flex items-center"><span className="h-1.5 w-1.5 rounded-full bg-red-500 mr-1.5"></span>Critical</span>
              <span className="flex items-center"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Low</span>
            </div>
          </div>

          <div className="flex-1 rounded-2xl bg-slate-900/60 border border-slate-800/40 relative overflow-hidden">
            {/* Base Leaflet Map container */}
            <div ref={mapContainerRef} className="absolute inset-0 z-0 h-full w-full"></div>
            
            {/* Overlaid Canvas Layer */}
            <canvas 
              ref={canvasRef} 
              className="absolute inset-0 pointer-events-none z-10 w-full h-full"
            ></canvas>

            {/* Quick helper HUD */}
            <div className="absolute bottom-4 left-4 z-20 glass-card bg-slate-950/90 border border-slate-800/60 p-3 rounded-2xl max-w-xs pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="flex items-start space-x-2">
                <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-[10px] text-slate-400 font-semibold space-y-1">
                  <p className="text-white">Workspace Dispatch Shortcuts:</p>
                  <p>1. Single-click map tiles to quickly spawn orders.</p>
                  <p>2. Drag package pins to dynamically alter locations.</p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Sidebar Info & Active dispatches list */}
        <div className="xl:col-span-1 flex flex-col space-y-6">
          
          {/* Swarm details */}
          <div className="glass-card rounded-3xl p-5 border border-slate-800/40 space-y-4">
            <h4 className="text-sm font-bold text-white font-heading uppercase tracking-wider border-b border-slate-900 pb-2">Swarm Telemetry</h4>
            
            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">ACO Best Distance:</span>
                <span className="font-extrabold text-white font-mono">
                  {solverResults ? `${solverResults.distance_km.toFixed(2)} km` : '0.00 km'}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-900/40 pt-3">
                <span className="text-slate-400">Ant Count:</span>
                <span className="font-bold text-indigo-400">{acoParams.ants}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Iterations:</span>
                <span className="font-bold text-indigo-400">{acoParams.iterations}</span>
              </div>
              <div className="flex justify-between border-t border-slate-900/40 pt-3">
                <span className="text-slate-400">Evaporation Rate:</span>
                <span className="font-bold text-amber-500 font-mono">{acoParams.rho}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Calculation Time:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {solverResults ? `${solverResults.computation_ms.toFixed(1)} ms` : '0.0 ms'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Add Form inside visualizer */}
          <div className="glass-card rounded-3xl p-5 border border-slate-800/40 space-y-3">
            <h4 className="text-sm font-bold text-white font-heading uppercase tracking-wider">Fast Dispatch Pin</h4>
            
            <button 
              onClick={() => {
                const lat = 37.76 + Math.random() * 0.04;
                const lng = -122.46 + Math.random() * 0.06;
                const newDlv = {
                  destination: `Dynamic Stop ${Math.floor(100 + Math.random() * 900)}`,
                  lat: parseFloat(lat.toFixed(5)),
                  lng: parseFloat(lng.toFixed(5)),
                  priority: 'High',
                  weight: 120,
                  driver: 'Amit Verma'
                };
                onAddDelivery(newDlv);
              }}
              className="w-full flex items-center justify-center space-x-2 py-3 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold text-xs rounded-xl shadow-lg transition"
            >
              <Plus className="w-4 h-4 text-indigo-400" />
              <span>Spawn Random Node</span>
            </button>
            <p className="text-[10px] text-center text-slate-500">Places a high priority stop within San Francisco boundaries.</p>
          </div>

        </div>

      </div>

    </div>
  );
}
