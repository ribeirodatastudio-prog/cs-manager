import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { STAT_NAMES } from '../engine/data';
import { calculateStatCost, getStability } from '../engine/mathUtils';
import { Activity } from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';

const GaragePanel = () => {
  const { getPlayerTeam, economy, actions } = useGame();
  const playerTeam = getPlayerTeam();
  const [selectedDriverIndex, setSelectedDriverIndex] = useState(0);

  if (!playerTeam) return <div className="p-4">No Team Data</div>;

  const currentDriver = playerTeam.drivers[selectedDriverIndex];

  // Prepare chart data
  const chartData = STAT_NAMES.map(stat => ({
    subject: stat,
    value: (currentDriver.stats as any)[stat],
    fullMark: 200,
  }));

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="flex border-b border-slate-800">
        {playerTeam.drivers.map((driver, idx) => (
          <button
            key={driver.id}
            onClick={() => setSelectedDriverIndex(idx)}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 text-sm font-bold uppercase transition-colors ${
              selectedDriverIndex === idx
                ? 'bg-slate-800 text-race-gold border-b-2 border-race-gold'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="text-lg">{driver.flag}</span>
            {driver.name.split(' ')[1]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Radar Chart */}
        <div className="h-48 w-full bg-slate-950/50 rounded border border-slate-800/50">
           <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
                 <PolarGrid stroke="#334155" />
                 <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                 <Radar name="Stats" dataKey="value" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.3} />
              </RadarChart>
           </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-between mb-2">
           <h3 className="text-slate-400 text-xs uppercase tracking-wider">Driver Stats</h3>
           <span className="text-xs text-slate-600">Total: {currentDriver.totalStats}</span>
        </div>

        {STAT_NAMES.map(stat => {
          // @ts-ignore
          const val = currentDriver.stats[stat];

          let displayLevel = `Lvl ${val}`;
          let stabilityInfo = null;
          let isMaxed = false;

          if (stat === 'Consistency') {
             displayLevel = `Lvl ${val}/100`;
             if (val >= 100) isMaxed = true;

             const stability = getStability(val);
             stabilityInfo = (
                <span className="text-[10px] text-blue-400 block mt-0.5">
                   Stability: {(stability * 100).toFixed(1)}%
                </span>
             );
          }

          const cost = calculateStatCost(val);
          const canAfford = !isMaxed && economy.points >= cost;

          return (
            <div key={stat} className="bg-slate-950 p-3 rounded border border-slate-800 flex items-center justify-between group hover:border-slate-700 transition-colors">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-300">{stat}</span>
                <span className="text-xs text-slate-500">{displayLevel}</span>
                {stabilityInfo}
              </div>

              <div className="flex items-center gap-4">
                 {!isMaxed ? (
                     <div className="text-right">
                        <div className={`text-xs font-mono ${canAfford ? 'text-emerald-400' : 'text-rose-900'}`}>
                           {Math.round(cost).toLocaleString()} PTS
                        </div>
                        <div className="text-[10px] text-slate-600">
                           Next: {val + 1}
                        </div>
                     </div>
                 ) : (
                     <div className="text-right text-xs text-slate-500 font-mono">MAX</div>
                 )}

                 <button
                   onClick={() => actions.upgradeStat(currentDriver.id, stat)}
                   disabled={!canAfford}
                   className={`p-2 rounded transition-all ${
                      canAfford
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'
                      : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                   }`}
                 >
                   <Activity size={16} />
                 </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-slate-950 border-t border-slate-800 text-xs text-slate-500 text-center">
         Upgrade stats to improve lap times. Costs increase exponentially.
      </div>
    </div>
  );
};

export default GaragePanel;
