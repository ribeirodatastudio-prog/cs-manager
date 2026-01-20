import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { STAT_NAMES, CAR_STAT_NAMES, ECONOMY } from '../engine/data';
import { calculateStatCost, getStability } from '../engine/mathUtils';
import { Activity, Car as CarIcon, User } from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';

type ViewMode = 'driver' | 'car';

const GaragePanel = () => {
  const { getPlayerTeam, economy, actions } = useGame();
  const playerTeam = getPlayerTeam();
  const [viewMode, setViewMode] = useState<ViewMode>('driver');
  const [selectedDriverIndex, setSelectedDriverIndex] = useState(0);

  if (!playerTeam) return <div className="p-4">No Team Data</div>;

  const currentDriver = playerTeam.drivers[selectedDriverIndex];
  const car = playerTeam.car;

  // Prepare chart data
  let chartData: any[] = [];
  if (viewMode === 'driver') {
      chartData = STAT_NAMES.map(stat => ({
        subject: stat,
        value: (currentDriver.stats as any)[stat],
        fullMark: 200,
      }));
  } else {
      chartData = CAR_STAT_NAMES.map(stat => ({
        subject: stat,
        value: (car.stats as any)[stat],
        fullMark: 200,
      }));
  }

  const getEffectiveBonus = (statName: string) => {
      if (!car) return 0;
      switch (statName) {
        case 'Cornering': return car.stats.Aero;
        case 'Overtaking': return car.stats.Engine;
        case 'Braking': return car.stats.Aero;
        case 'Instincts': return car.stats.Engineering;
        case 'Acceleration': return car.stats.Engine;
        case 'Consistency': return car.stats.Engineering;
        case 'Pace': return car.stats.Aero;
        default: return 0;
      }
  };

  const renderContent = () => {
      if (viewMode === 'car') {
          return (
            <>
                <div className="flex items-center justify-between mb-2">
                   <h3 className="text-slate-400 text-xs uppercase tracking-wider">Car Development</h3>
                   <div className="flex flex-col items-end">
                       <span className="text-xs text-slate-600">Total: {car.totalStats}</span>
                       <span className="text-xs text-race-gold font-mono">R&D Funds: {economy.rdPoints.toFixed(1)}</span>
                   </div>
                </div>

                {CAR_STAT_NAMES.map(stat => {
                    // @ts-ignore
                    const val = car.stats[stat];
                    // Cost formula: Base * (Exponent ^ (Level - 1))
                    const cost = Math.floor(ECONOMY.CAR_BASE_COST * Math.pow(ECONOMY.CAR_COST_EXPONENT, val - 1));
                    const canAfford = economy.rdPoints >= cost;

                    return (
                        <div key={stat} className="bg-slate-950 p-3 rounded border border-slate-800 flex items-center justify-between group hover:border-slate-700 transition-colors">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-300">{stat}</span>
                            <span className="text-xs text-slate-500">Lvl {val}</span>
                            <span className="text-[10px] text-slate-600">Boosts related driver stats</span>
                          </div>

                          <div className="flex items-center gap-4">
                                 <div className="text-right">
                                    <div className={`text-xs font-mono ${canAfford ? 'text-emerald-400' : 'text-rose-900'}`}>
                                       {cost.toLocaleString()} R&D
                                    </div>
                                    <div className="text-[10px] text-slate-600">
                                       Next: {val + 1}
                                    </div>
                                 </div>

                             <button
                               onClick={() => actions.upgradeCarStat(stat)}
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
            </>
          );
      }

      return (
        <>
            <div className="flex items-center justify-between mb-2">
               <h3 className="text-slate-400 text-xs uppercase tracking-wider">Driver Stats</h3>
               <span className="text-xs text-slate-600">Total: {currentDriver.totalStats}</span>
            </div>

            {STAT_NAMES.map(stat => {
              // @ts-ignore
              const val = currentDriver.stats[stat];
              const bonus = getEffectiveBonus(stat);
              const effective = val + bonus;

              let displayLevel = `Base ${val}`;
              let effectiveDisplay = `Effect: ${effective} (+${bonus} Car)`;
              let stabilityInfo = null;
              let isMaxed = false;

              if (stat === 'Consistency') {
                 // Cap effective at 100
                 const cappedEffective = Math.min(effective, 100);
                 effectiveDisplay = `Effect: ${cappedEffective}/100 (+${bonus} Car)`;

                 if (val >= 100) isMaxed = true; // Base stat maxed? Or effective? Usually base.
                 // If effective is 100, do we stop upgrading base?
                 // Logic says "Math.min(driver + car, 100)".
                 // User might still want to upgrade base if car is weak, but if total > 100 it's waste.
                 // We will just show info.

                 const stability = getStability(cappedEffective);
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
                    <div className="flex items-baseline gap-2">
                        <span className="text-sm font-bold text-slate-300">{stat}</span>
                        <span className="text-xs text-emerald-500">{effectiveDisplay}</span>
                    </div>
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
        </>
      );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="flex border-b border-slate-800">
        {playerTeam.drivers.map((driver, idx) => (
          <button
            key={driver.id}
            onClick={() => { setSelectedDriverIndex(idx); setViewMode('driver'); }}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 text-sm font-bold uppercase transition-colors ${
              viewMode === 'driver' && selectedDriverIndex === idx
                ? 'bg-slate-800 text-race-gold border-b-2 border-race-gold'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <User size={14} />
            <span className="text-lg">{driver.flag}</span>
            <span className="hidden md:inline">{driver.name.split(' ')[1]}</span>
          </button>
        ))}
        <button
            onClick={() => setViewMode('car')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 text-sm font-bold uppercase transition-colors ${
              viewMode === 'car'
                ? 'bg-slate-800 text-race-gold border-b-2 border-race-gold'
                : 'text-slate-500 hover:text-slate-300'
            }`}
        >
            <CarIcon size={14} />
            <span>Car</span>
        </button>
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

        {renderContent()}
      </div>

      <div className="p-4 bg-slate-950 border-t border-slate-800 text-xs text-slate-500 text-center">
         {viewMode === 'driver'
            ? "Upgrade stats to improve lap times. Costs increase exponentially."
            : "Upgrade Car components to boost both drivers. Requires R&D Points."}
      </div>
    </div>
  );
};

export default GaragePanel;
