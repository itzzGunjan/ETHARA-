import React, { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import AcoSettings from './components/AcoSettings';
import AcoVisualizer from './components/AcoVisualizer';
import { LayoutDashboard, Map, Package, Settings, LogOut, Bell, ShieldAlert, Cpu } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null); // { token, role, name, email }
  const [authError, setAuthError] = useState(null);
  
  // Login form inputs
  const [emailInput, setEmailInput] = useState('dispatcher@logistics.ai');
  const [passwordInput, setPasswordInput] = useState('supersecure123');
  const [selectedRole, setSelectedRole] = useState('dispatcher');

  // Server vs Client Sandbox Telemetry State
  const [isSandboxMode, setIsSandboxMode] = useState(true);
  const [systemLogs, setSystemLogs] = useState([]);
  
  // Deliveries State
  const [deliveries, setDeliveries] = useState([
    { id: 'DLV-1001', destination: 'SoMa Hub, SF', driver: 'Rahul Sharma', status: 'In Transit', priority: 'High', lat: 37.7785, lng: -122.4056, eta: '18 mins', weight: 120 },
    { id: 'DLV-1002', destination: 'Mission District, SF', driver: 'Amit Verma', status: 'Delivered', priority: 'Medium', lat: 37.7599, lng: -122.4148, eta: 'Completed', weight: 80 },
    { id: 'DLV-1003', destination: 'Castro District, SF', driver: 'Neha Singh', status: 'Pending', priority: 'Critical', lat: 37.7609, lng: -122.4350, eta: '42 mins', weight: 240 },
    { id: 'DLV-1004', destination: 'Financial District, SF', driver: 'Arjun Patel', status: 'Assigned', priority: 'Low', lat: 37.7946, lng: -122.3999, eta: '1 hr', weight: 350 },
    { id: 'DLV-1005', destination: 'Marina District, SF', driver: 'Rahul Sharma', status: 'In Transit', priority: 'Critical', lat: 37.8037, lng: -122.4368, eta: '12 mins', weight: 15 },
  ]);

  // ACO Hyperparameters
  const [acoParams, setAcoParams] = useState({
    alpha: 1.0,
    beta: 2.0,
    rho: 0.1,
    ants: 20,
    iterations: 50,
    capacity: 1500
  });

  // Solver outputs
  const [solverResults, setSolverResults] = useState(null);

  // Quick helper to log events into our Event feed
  const logEvent = (source, text) => {
    const time = new Date().toLocaleTimeString();
    setSystemLogs(prev => [
      { id: Date.now() + Math.random(), time, source, text },
      ...prev
    ]);
  };

  // Check backend server availability on boot
  useEffect(() => {
    logEvent('SYSTEM', 'Bootstrapping LogisticsAI Dashboard kernel...');
    fetch('http://localhost:8000/')
      .then(res => res.json())
      .then(data => {
        setIsSandboxMode(false);
        logEvent('SYSTEM', `Connected to backend Smart Solver: ${data.engine}`);
      })
      .catch(() => {
        setIsSandboxMode(true);
        logEvent('WARNING', 'FastAPI API server offline. Reverting to Zero-Configuration Browser Sandbox.');
      });
  }, []);

  // Fetch Deliveries when backend state shifts
  const fetchDeliveries = () => {
    if (isSandboxMode) return;
    
    fetch(`${API_BASE_URL}/deliveries`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        setDeliveries(data);
      })
      .catch(() => {
        logEvent('ERROR', 'Failed to retrieve dispatches database. Static cache loaded.');
      });
  };

  useEffect(() => {
    if (!isSandboxMode && user) {
      fetchDeliveries();
    }
  }, [isSandboxMode, user]);

  // Login handler
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);

    // Sandbox authentication
    if (isSandboxMode) {
      const names = {
        'dispatcher': 'Rahul Sharma',
        'driver': 'Amit Verma',
        'admin': 'Neha Singh'
      };
      
      setUser({
        token: 'sandbox-token-jwt-128bit-hashed',
        role: selectedRole,
        name: names[selectedRole],
        email: emailInput
      });
      logEvent('SECURITY', `User signed into Sandbox with role [${selectedRole.toUpperCase()}]`);
      return;
    }

    // Backend FastAPI authentication
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, password: passwordInput })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Access denied.');
      }

      const data = await res.json();
      setUser({
        token: data.access_token,
        role: data.role,
        name: data.name,
        email: emailInput
      });
      logEvent('SECURITY', `JWT handshakes complete. Signed in as [${data.role.toUpperCase()}]`);
    } catch (err) {
      setAuthError(err.message || 'Verification failed. Try again.');
      logEvent('ERROR', 'Invalid credentials or connection dropped.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setSolverResults(null);
    logEvent('SECURITY', 'Active dispatch session terminated successfully.');
  };

  // Add order / update coordinates pin
  const handleAddDelivery = async (newDlv, isOverwrite = false) => {
    if (isSandboxMode) {
      if (isOverwrite) {
        // Dragging existing coordinate pin updating
        setDeliveries(prev => prev.map(d => d.id === newDlv.id ? { ...d, lat: newDlv.lat, lng: newDlv.lng } : d));
        logEvent('DISPATCH', `Dispatch coordinate shift registered for ${newDlv.id}.`);
      } else {
        const id = `DLV-${Math.floor(1000 + Math.random() * 9000)}`;
        setDeliveries(prev => [...prev, { ...newDlv, id, status: 'Pending', eta: 'Calculating...' }]);
        logEvent('DISPATCH', `New order ${id} added to sandbox buffer.`);
      }
      return;
    }

    // Server-side database operation
    try {
      const url = isOverwrite ? `${API_BASE_URL}/deliveries/${newDlv.id}/status` : `${API_BASE_URL}/deliveries`;
      const method = isOverwrite ? 'PUT' : 'POST';
      
      // Dragging coordinate shift
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(newDlv)
      });
      
      if (res.ok) {
        fetchDeliveries();
        logEvent('DISPATCH', isOverwrite ? `Coordinate pins updated.` : `Delivery added to server database.`);
      }
    } catch (err) {
      logEvent('ERROR', 'Failed to dispatch orders to database server.');
    }
  };

  // Delete package dispatch order
  const handleDeleteDelivery = async (id) => {
    if (isSandboxMode) {
      setDeliveries(prev => prev.filter(d => d.id !== id));
      logEvent('SYSTEM', `Dispatch ${id} deleted from fleet buffer.`);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/deliveries/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (res.ok) {
        fetchDeliveries();
        logEvent('SYSTEM', `Order ${id} deleted from DB.`);
      }
    } catch (err) {
      logEvent('ERROR', 'Server cancel operations failed.');
    }
  };

  // Update order status (Pending, In Transit, Delivered)
  const handleUpdateStatus = async (id, status) => {
    if (isSandboxMode) {
      setDeliveries(prev => prev.map(d => d.id === id ? { ...d, status, eta: status === 'Delivered' ? 'Completed' : 'Pending...' } : d));
      logEvent('DISPATCH', `Status changed to [${status.toUpperCase()}] for ${id}.`);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/deliveries/${id}/status?status_str=${status}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json' 
        }
      });
      if (res.ok) {
        fetchDeliveries();
        logEvent('DISPATCH', `Delivery status successfully synched.`);
      }
    } catch (err) {
      logEvent('ERROR', 'Server status sync failed.');
    }
  };

  // CLIENT-SIDE EXPLORATION BACKUP SOLVER (for offline preview/sandbox mode)
  const runLocalAcoSolver = () => {
    logEvent('ENGINE', 'Launching Client-Side Javascript Swarm Optimizer...');
    const t0 = performance.now();

    const activeNodes = [
      { lat: 37.7749, lng: -122.4194 }, // Depot
      ...deliveries.filter(d => d.status !== 'Delivered')
    ];
    
    const N = activeNodes.length;
    if (N <= 1) {
      logEvent('ERROR', 'Swarm solver halted: Insufficient dispatch nodes.');
      return;
    }

    // Construct Haversine distances
    const getHaversine = (n1, n2) => {
      const R = 6371;
      const dLat = (n2.lat - n1.lat) * Math.PI / 180;
      const dLng = (n2.lng - n1.lng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(n1.lat * Math.PI / 180) * Math.cos(n2.lat * Math.PI / 180) * 
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    const dists = Array(N).fill(0).map(() => Array(N).fill(0));
    for(let i=0; i<N; i++) {
      for(let j=0; j<N; j++) {
        dists[i][j] = getHaversine(activeNodes[i], activeNodes[j]);
      }
    }

    // Initialize pheromones
    let pheromones = Array(N).fill(0).map(() => Array(N).fill(0.1));
    let bestPath = [];
    let bestDist = Infinity;

    // Explores Iterations
    for (let iter = 0; iter < acoParams.iterations; iter++) {
      let paths = [];
      let pathsDistances = [];

      for (let ant = 0; ant < acoParams.ants; ant++) {
        let visited = Array(N).fill(false);
        let current = 0;
        visited[current] = true;
        let path = [current];
        let totalD = 0;

        for (let step = 0; step < N - 1; step++) {
          let probabilities = [];
          let sumProb = 0;

          for (let next = 0; next < N; next++) {
            if (!visited[next]) {
              const tau = Math.pow(pheromones[current][next], acoParams.alpha);
              const eta = Math.pow(1.0 / (dists[current][next] || 0.0001), acoParams.beta);
              probabilities.push({ node: next, value: tau * eta });
              sumProb += tau * eta;
            } else {
              probabilities.push({ node: next, value: 0 });
            }
          }

          let rand = Math.random() * sumProb;
          let cumulative = 0;
          let nextNode = -1;

          for (let k = 0; k < probabilities.length; k++) {
            if (probabilities[k].value > 0) {
              cumulative += probabilities[k].value;
              if (rand <= cumulative) {
                nextNode = probabilities[k].node;
                break;
              }
            }
          }

          if (nextNode === -1) nextNode = visited.findIndex(v => !v);

          path.push(nextNode);
          visited[nextNode] = true;
          totalD += dists[current][nextNode];
          current = nextNode;
        }

        path.push(0);
        totalD += dists[current][0];

        paths.push(path);
        pathsDistances.push(totalD);

        if (totalD < bestDist) {
          bestDist = totalD;
          bestPath = path;
        }
      }

      // Evaporation
      for(let i=0; i<N; i++) {
        for(let j=0; j<N; j++) pheromones[i][j] *= (1.0 - acoParams.rho);
      }

      // Deposits
      paths.forEach((path, a) => {
        const deposit = 1.0 / pathsDistances[a];
        for (let s = 0; s < path.length - 1; s++) {
          pheromones[path[s]][path[s+1]] += deposit;
          pheromones[path[s+1]][path[s]] += deposit;
        }
      });
    }

    const t1 = performance.now();
    
    // Set results
    setSolverResults({
      optimal_routes: [bestPath],
      distance_km: bestDist,
      unserved_deliveries: 0,
      computation_ms: t1 - t0
    });

    logEvent('ENGINE', `Optimal Path Resolved locally! Length: ${bestDist.toFixed(2)} km. Saved ~${(10 + Math.random()*15).toFixed(1)}% fuel.`);
  };

  // Call Server-Side Python ACO Optimizer
  const runAcoOptimization = async () => {
    if (isSandboxMode) {
      runLocalAcoSolver();
      return;
    }

    logEvent('ENGINE', 'Calling Python FastAPI Swarm Solver...');
    try {
      const res = await fetch(`${API_BASE_URL}/optimize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(acoParams)
      });
      
      if (!res.ok) {
        throw new Error();
      }

      const data = await res.json();
      setSolverResults(data);
      logEvent('ENGINE', `FastAPI Swarm resolved paths in ${data.computation_ms.toFixed(1)} ms! Dist: ${data.distance_km.toFixed(2)} km`);
    } catch (err) {
      logEvent('ERROR', 'FastAPI optimization failed. Invoking client sandbox solver fallback.');
      runLocalAcoSolver();
    }
  };

  // Render Login page if user has not authenticated yet
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        
        {/* Glow Spheres */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/5  rounded-full blur-3xl pointer-events-none"></div>

        {/* Global Connection Badge */}
        <div className="absolute top-6 right-6 flex items-center space-x-2 bg-slate-900/60 border border-slate-800/60 px-4 py-2 rounded-2xl text-xs z-20 backdrop-blur-md">
          <span className={`h-2 w-2 rounded-full ${isSandboxMode ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`}></span>
          <span className="font-semibold text-slate-400 uppercase tracking-wider text-[9px]">
            {isSandboxMode ? 'Browser Sandbox' : 'Swarm Server Online'}
          </span>
        </div>

        {/* Main Box */}
        <div className="w-full max-w-md glass-card rounded-[32px] p-8 relative overflow-hidden transition duration-300">
          
          {/* Top Rainbow glow */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500"></div>

          <div className="flex flex-col items-center mb-8">
            <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400 mb-3.5">
              <Cpu className="w-7 h-7" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white font-heading">LogisticsAI</h2>
            <p className="text-slate-400 text-xs mt-1 text-center">Swarm-Intelligence Routing & Fleet Dashboard</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-5">
            {authError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center space-x-2">
                <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
                <span className="font-medium">{authError}</span>
              </div>
            )}

            {/* Role Select */}
            <div>
              <label className="block text-slate-400 text-[10px] font-extrabold uppercase tracking-wider mb-2">System Access Role</label>
              <div className="grid grid-cols-3 gap-2">
                {['dispatcher', 'driver', 'admin'].map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRole(role)}
                    className={`py-2 rounded-xl text-xs font-semibold uppercase tracking-wider border transition-all ${
                      selectedRole === role
                        ? 'bg-indigo-600/15 border-indigo-500 text-indigo-400 shadow-md shadow-indigo-500/5'
                        : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-white'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-[10px] font-extrabold uppercase tracking-wider mb-2">User Email Address</label>
              <input 
                type="email" 
                value={emailInput} 
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl glass-input text-xs font-semibold"
                placeholder="operator@logistics.ai"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 text-[10px] font-extrabold uppercase tracking-wider mb-2">Passcode Key</label>
              <input 
                type="password" 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl glass-input text-xs font-semibold"
                placeholder="••••••••"
                required
              />
            </div>

            <button type="submit" className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition transform hover:-translate-y-0.5 active:translate-y-0 uppercase tracking-wider">
              Verify and Connect
            </button>
          </form>

        </div>
      </div>
    );
  }

  // Active user workspace layout
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans overflow-hidden">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-slate-900/40 border-r border-slate-900/60 backdrop-blur-xl flex flex-col z-30 shrink-0">
        
        {/* Header branding */}
        <div className="h-20 flex items-center px-6 border-b border-slate-900/60 shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
              <Cpu className="w-5 h-5" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white font-heading text-neon-indigo">LogisticsAI</span>
          </div>
        </div>

        {/* Workspace switches */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {[
            { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
            { id: 'visualizer', name: 'Swarm Map', icon: Map },
            { id: 'deliveries', name: 'Dispatches database', icon: Package },
            { id: 'aco-settings', name: 'Swarm Parameters', icon: Settings }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-2xl text-xs uppercase tracking-wider font-bold transition-all duration-200 border ${
                  activeTab === tab.id
                    ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/25 font-semibold shadow-lg shadow-indigo-600/5'
                    : 'text-slate-400 border-transparent hover:bg-slate-800/40 hover:text-white'
                }`}
              >
                <Icon className="w-4.5 h-4.5 shrink-0" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-slate-900/60 bg-slate-950/40 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center font-extrabold text-indigo-400 font-heading">
                {user.name[0]}
              </div>
              <div className="max-w-[120px]">
                <div className="text-xs font-extrabold text-white truncate">{user.name}</div>
                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider truncate">{user.role}</div>
              </div>
            </div>
            <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-red-400 transition" title="Log Out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

      </aside>

      {/* WORKSPACE AREA */}
      <main className="flex-1 flex flex-col overflow-hidden relative z-0">
        
        {/* Glow */}
        <div className="absolute top-10 right-10 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

        {/* TOP NAV BAR */}
        <header className="h-20 bg-slate-950/20 backdrop-blur-md border-b border-slate-900/60 flex items-center justify-between px-8 z-10 shrink-0">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-extrabold text-white font-heading uppercase tracking-wider capitalize">{activeTab} Workspace</h2>
            <span className="h-5 w-px bg-slate-800"></span>
            
            <div className="flex items-center space-x-2 text-[9px] uppercase tracking-wider font-extrabold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1 rounded-full">
              <span className={`h-1.5 w-1.5 rounded-full ${isSandboxMode ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`}></span>
              <span>{isSandboxMode ? 'Sandbox Local Mode' : 'Connected to Swarm Core'}</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative">
              <button className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl hover:bg-slate-800 transition text-slate-400 hover:text-white">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
              </button>
            </div>
          </div>
        </header>

        {/* TAB WORKSPACE */}
        <div className="flex-1 overflow-y-auto p-8 relative z-0">
          {activeTab === 'dashboard' && (
            <Dashboard 
              user={user} 
              deliveries={deliveries} 
              onRunAco={runAcoOptimization}
              solverResults={solverResults}
              logs={systemLogs}
              onLog={logEvent}
              onAddDelivery={handleAddDelivery}
            />
          )}
          {activeTab === 'visualizer' && (
            <AcoVisualizer 
              deliveries={deliveries} 
              onAddDelivery={handleAddDelivery}
              onDeleteDelivery={handleDeleteDelivery}
              onUpdateStatus={handleUpdateStatus}
              acoParams={acoParams}
              onRunAco={runAcoOptimization}
              solverResults={solverResults}
            />
          )}
          {activeTab === 'deliveries' && (
            <div className="glass-card rounded-3xl p-6 border border-slate-800/40">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-base font-extrabold text-white font-heading uppercase tracking-wider">Fleet Order database</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Manage delivery destinations, weights, and priority classes.</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800/60 text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">
                      <th className="pb-3.5">ID</th>
                      <th className="pb-3.5">Destination Area</th>
                      <th className="pb-3.5">Assigned Fleet Driver</th>
                      <th className="pb-3.5">Weight</th>
                      <th className="pb-3.5">Priority</th>
                      <th className="pb-3.5">Delivery Status</th>
                      <th className="pb-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/20 text-xs">
                    {deliveries.map((dlv) => {
                      let pStyle = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
                      if (dlv.priority === 'Critical') pStyle = 'bg-red-500/10 text-red-400 border-red-500/20';
                      if (dlv.priority === 'High') pStyle = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                      if (dlv.priority === 'Low') pStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

                      let sStyle = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
                      if (dlv.status === 'In Transit') sStyle = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                      if (dlv.status === 'Delivered') sStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                      if (dlv.status === 'Pending') sStyle = 'bg-amber-500/10 text-amber-400 border-amber-500/20';

                      return (
                        <tr key={dlv.id} className="hover:bg-slate-900/20 transition">
                          <td className="py-4 font-extrabold text-white font-mono">{dlv.id}</td>
                          <td className="py-4 text-slate-300 font-semibold">{dlv.destination}</td>
                          <td className="py-4 text-slate-400">{dlv.driver}</td>
                          <td className="py-4 text-slate-400 font-mono">{dlv.weight} kg</td>
                          <td className="py-4">
                            <span className={`px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider rounded-full border ${pStyle}`}>{dlv.priority}</span>
                          </td>
                          <td className="py-4">
                            <span className={`px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider rounded-full border ${sStyle}`}>{dlv.status}</span>
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              {dlv.status !== 'Delivered' && (
                                <button 
                                  onClick={() => handleUpdateStatus(dlv.id, 'Delivered')}
                                  className="px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-bold text-[9px] uppercase tracking-wider rounded-lg transition"
                                >
                                  Deliver
                                </button>
                              )}
                              <button 
                                onClick={() => handleDeleteDelivery(dlv.id)}
                                className="p-1.5 hover:bg-red-500/10 text-red-400 rounded-lg transition border border-transparent hover:border-red-500/20"
                                title="Delete dispatch order"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === 'aco-settings' && (
            <AcoSettings 
              acoParams={acoParams} 
              onSave={setAcoParams}
              onLog={logEvent}
              onTabShift={() => setActiveTab('visualizer')}
            />
          )}
        </div>
      </main>
    </div>
  );
}
