import React, { useState } from 'react';
import { HelpCircle, Sliders, Play, CheckCircle } from 'lucide-react';

export default function AcoSettings({ acoParams, onSave, onLog, onTabShift }) {
  const [params, setParams] = useState({ ...acoParams });
  const [showSavedToast, setShowSavedToast] = useState(false);

  const handleChange = (name, val) => {
    setParams(prev => ({
      ...prev,
      [name]: val
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(params);
    onLog('ENGINE', `Hyper-parameters calibrated: Alpha=${params.alpha}, Beta=${params.beta}, Decay=${params.rho}, Ants=${params.ants}`);
    setShowSavedToast(true);
    setTimeout(() => {
      setShowSavedToast(false);
      onTabShift(); // Automatic tab redirection to mapping view to trigger immediate recalculations!
    }, 1200);
  };

  return (
    <div className="max-w-3xl bg-slate-900/40 border border-slate-800/40 backdrop-blur-xl rounded-[32px] p-8 space-y-6 animate-fadeIn relative">
      
      {/* Toast Alert */}
      {showSavedToast && (
        <div className="absolute top-6 right-6 px-4 py-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs rounded-xl flex items-center space-x-2 animate-bounce z-20">
          <CheckCircle className="w-4 h-4" />
          <span className="font-bold">Swarm Calibrated! Redirection live...</span>
        </div>
      )}

      <div className="border-b border-slate-900 pb-4">
        <h3 className="text-base font-extrabold text-white font-heading uppercase tracking-wider">Ant Colony Swarm Configurator</h3>
        <p className="text-slate-400 text-xs mt-1">Fine-tune the mathematical parameters governing artificial swarm intelligence exploration.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Alpha parameter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 text-xs font-bold uppercase tracking-wider flex items-center space-x-2">
                <span>Pheromone Influence (α)</span>
                <div className="group relative cursor-help">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-6 hidden group-hover:block w-48 p-2 bg-slate-950 border border-slate-800 text-[10px] text-slate-400 rounded-lg shadow-xl leading-relaxed text-center z-30">
                    Governs the weights of deposited pheromones. Higher values cause ants to strictly follow past successful routes, locking in paths faster.
                  </div>
                </div>
              </label>
              <span className="text-xs text-indigo-400 font-bold font-mono">{params.alpha.toFixed(1)}</span>
            </div>
            <input 
              type="range" min="0" max="5" step="0.1"
              value={params.alpha} 
              onChange={(e) => handleChange('alpha', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
            />
            <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">Lower values favor independent route exploration; higher values lock swarm patterns rapidly.</p>
          </div>

          {/* Beta parameter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 text-xs font-bold uppercase tracking-wider flex items-center space-x-2">
                <span>Heuristic Distance Weight (β)</span>
                <div className="group relative cursor-help">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-6 hidden group-hover:block w-48 p-2 bg-slate-950 border border-slate-800 text-[10px] text-slate-400 rounded-lg shadow-xl leading-relaxed text-center z-30">
                    Governs the influence of distances. Higher values force ants to act greedily, prioritizing immediately closer stops.
                  </div>
                </div>
              </label>
              <span className="text-xs text-indigo-400 font-bold font-mono">{params.beta.toFixed(1)}</span>
            </div>
            <input 
              type="range" min="0" max="5" step="0.1"
              value={params.beta} 
              onChange={(e) => handleChange('beta', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
            />
            <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">Higher makes the solver act like a standard Greedy/Nearest Neighbor algorithm.</p>
          </div>

          {/* Evaporation Rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 text-xs font-bold uppercase tracking-wider flex items-center space-x-2">
                <span>Pheromone Evaporation (ρ)</span>
                <div className="group relative cursor-help">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-6 hidden group-hover:block w-48 p-2 bg-slate-950 border border-slate-800 text-[10px] text-slate-400 rounded-lg shadow-xl leading-relaxed text-center z-30">
                    The rate at which pheromones decay on paths after each iteration. High decay rates prevent the system from getting stuck in sub-optimal local routes.
                  </div>
                </div>
              </label>
              <span className="text-xs text-indigo-400 font-bold font-mono">{params.rho.toFixed(2)}</span>
            </div>
            <input 
              type="range" min="0.01" max="0.5" step="0.01"
              value={params.rho} 
              onChange={(e) => handleChange('rho', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
            />
            <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">Controls the decay speed. Standard decay is 0.10 (10% decay per cycle).</p>
          </div>

          {/* Ant count */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 text-xs font-bold uppercase tracking-wider flex items-center space-x-2">
                <span>Active Swarm Size (Ants)</span>
                <div className="group relative cursor-help">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-6 hidden group-hover:block w-48 p-2 bg-slate-950 border border-slate-800 text-[10px] text-slate-400 rounded-lg shadow-xl leading-relaxed text-center z-30">
                    The number of simulated ants deployed to search and lay paths. Larger swarms evaluate paths thoroughly but require more computer power.
                  </div>
                </div>
              </label>
              <span className="text-xs text-indigo-400 font-bold font-mono">{params.ants}</span>
            </div>
            <input 
              type="range" min="5" max="100" step="5"
              value={params.ants} 
              onChange={(e) => handleChange('ants', parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
            />
            <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">More ants improve optimization accuracy but increase server computation times.</p>
          </div>

          {/* Iterations count */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 text-xs font-bold uppercase tracking-wider flex items-center space-x-2">
                <span>Swarm Search Cycles (Iterations)</span>
              </label>
              <span className="text-xs text-indigo-400 font-bold font-mono">{params.iterations}</span>
            </div>
            <input 
              type="range" min="10" max="250" step="5"
              value={params.iterations} 
              onChange={(e) => handleChange('iterations', parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
            />
            <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">Number of cycles the ants repeat to reinforce high-pheromone shortest paths.</p>
          </div>

          {/* Vehicle load capacities */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 text-xs font-bold uppercase tracking-wider flex items-center space-x-2">
                <span>Vehicle Cargo Payload Limit</span>
              </label>
              <span className="text-xs text-indigo-400 font-bold font-mono">{params.capacity} kg</span>
            </div>
            <input 
              type="range" min="500" max="5000" step="100"
              value={params.capacity} 
              onChange={(e) => handleChange('capacity', parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
            />
            <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">Governs maximum payload carry limits for VRP vehicle tour restrictions.</p>
          </div>

        </div>

        <div className="flex justify-end pt-5 border-t border-slate-900/60 mt-6">
          <button type="submit" className="flex items-center space-x-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition duration-200 uppercase tracking-wider">
            <Sliders className="w-4.5 h-4.5" />
            <span>Apply Settings & Re-Solve</span>
          </button>
        </div>
      </form>
    </div>
  );
}
