import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { formatTime } from '../engine/mathUtils';
import { Trophy, ChevronRight, Play } from 'lucide-react';

export const PostRaceSummary = () => {
  const { raceData, season, grid, actions } = useGame();
  const [activeTab, setActiveTab] = useState<'results' | 'standings'>('results');

  const { results } = raceData;

  // Calculate Fastest Lap
  let fastestLapTime = Infinity;
  let fastestDriverId = null;
  results.forEach(r => {
    if (r.bestLapTime > 0 && r.bestLapTime < fastestLapTime) {
      fastestLapTime = r.bestLapTime;
      fastestDriverId = r.driverId;
    }
  });

  // Helper to get Driver/Team names
  const getDriverInfo = (driverId: string) => {
     const driver = grid.flatMap(t => t.drivers).find(d => d.id === driverId);
     const team = grid.find(t => t.id === driver?.teamId);
     return { driver, team };
  };

  const StandingsView = () => {
     const driverStandings = Object.entries(season.standings.drivers)
        .sort(([, a], [, b]) => b - a)
        .map(([id, pts], idx) => {
             const { driver, team } = getDriverInfo(id);
             return { rank: idx + 1, name: driver?.name || id, team: team?.name || '', points: pts };
        });

     const teamStandings = Object.entries(season.standings.teams)
        .sort(([, a], [, b]) => b - a)
        .map(([id, pts], idx) => {
             const team = grid.find(t => t.id === id);
             return { rank: idx + 1, name: team?.name || id, points: pts };
        });

     return (
        <div className="flex gap-4 h-full overflow-hidden">
           <div className="flex-1 flex flex-col overflow-hidden bg-slate-900/50 rounded border border-slate-800">
              <h3 className="p-2 font-bold text-center border-b border-slate-800 text-slate-300">DRIVER STANDINGS</h3>
              <div className="overflow-y-auto flex-1">
                 <table className="w-full text-left text-sm">
                    <thead>
                       <tr className="text-slate-500 border-b border-slate-800">
                          <th className="p-2 w-12 text-center">Pos</th>
                          <th className="p-2">Driver</th>
                          <th className="p-2 text-right">Pts</th>
                       </tr>
                    </thead>
                    <tbody>
                       {driverStandings.map(d => (
                          <tr key={d.rank} className="border-b border-slate-800/50">
                             <td className="p-2 text-center font-mono text-slate-500">{d.rank}</td>
                             <td className="p-2">
                                <div className="font-bold text-slate-200">{d.name}</div>
                                <div className="text-xs text-slate-500">{d.team}</div>
                             </td>
                             <td className="p-2 text-right font-mono font-bold text-race-gold">{d.points}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>

           <div className="flex-1 flex flex-col overflow-hidden bg-slate-900/50 rounded border border-slate-800">
              <h3 className="p-2 font-bold text-center border-b border-slate-800 text-slate-300">CONSTRUCTOR STANDINGS</h3>
              <div className="overflow-y-auto flex-1">
                 <table className="w-full text-left text-sm">
                    <thead>
                       <tr className="text-slate-500 border-b border-slate-800">
                          <th className="p-2 w-12 text-center">Pos</th>
                          <th className="p-2">Team</th>
                          <th className="p-2 text-right">Pts</th>
                       </tr>
                    </thead>
                    <tbody>
                       {teamStandings.map(t => (
                          <tr key={t.rank} className="border-b border-slate-800/50">
                             <td className="p-2 text-center font-mono text-slate-500">{t.rank}</td>
                             <td className="p-2 font-bold text-slate-200">{t.name}</td>
                             <td className="p-2 text-right font-mono font-bold text-race-gold">{t.points}</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
     );
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-8">
       <div className="w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden flex flex-col h-[80vh]">
          {/* Header */}
          <div className="bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
             <div className="flex items-center gap-3">
                <Trophy className="text-race-gold" size={32} />
                <div>
                   <h2 className="text-2xl font-bold text-white tracking-tighter">RACE SUMMARY</h2>
                   <span className="text-sm text-slate-400 font-mono">ROUND {season.raceNumber} / {season.totalRaces}</span>
                </div>
             </div>
             <div className="flex bg-slate-900 rounded p-1 border border-slate-800">
                <button
                   onClick={() => setActiveTab('results')}
                   className={`px-4 py-1 rounded text-sm font-bold transition-colors ${activeTab === 'results' ? 'bg-race-purple text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                   RESULTS
                </button>
                <button
                   onClick={() => setActiveTab('standings')}
                   className={`px-4 py-1 rounded text-sm font-bold transition-colors ${activeTab === 'standings' ? 'bg-race-purple text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                   STANDINGS
                </button>
             </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden p-4">
             {activeTab === 'results' ? (
                <div className="h-full overflow-y-auto border border-slate-800 rounded">
                   <table className="w-full text-left text-sm">
                      <thead className="bg-slate-950 sticky top-0">
                         <tr className="text-slate-400 border-b border-slate-800">
                            <th className="p-3 w-16 text-center">Pos</th>
                            <th className="p-3">Driver</th>
                            <th className="p-3 text-right">Time/Gap</th>
                            <th className="p-3 text-right">Best Lap</th>
                            <th className="p-3 text-right">Pts</th>
                         </tr>
                      </thead>
                      <tbody>
                         {results.map((r, idx) => {
                            const isFastest = r.driverId === fastestDriverId;
                            let pts = 41 - r.rank;
                            if (pts < 1) pts = 1;
                            const totalPts = pts + (isFastest ? 1 : 0);
                            const leader = results[0];
                            const gap = r.totalTime - leader.totalTime;

                            return (
                               <tr key={r.driverId} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                                  <td className={`p-3 text-center font-mono font-bold ${r.rank === 1 ? 'text-race-gold' : 'text-slate-500'}`}>{r.rank}</td>
                                  <td className="p-3">
                                     <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-200">{r.driverName}</span>
                                        <span className="text-xs text-slate-500 bg-slate-900 px-1 rounded border border-slate-800">{r.teamName}</span>
                                     </div>
                                  </td>
                                  <td className="p-3 text-right font-mono text-slate-400">
                                     {r.rank === 1 ? formatTime(r.totalTime) : `+${formatTime(gap)}`}
                                  </td>
                                  <td className={`p-3 text-right font-mono ${isFastest ? 'text-purple-400 font-bold' : 'text-slate-500'}`}>
                                     {formatTime(r.bestLapTime)}
                                  </td>
                                  <td className="p-3 text-right font-mono font-bold text-emerald-400">
                                     +{totalPts}
                                  </td>
                               </tr>
                            );
                         })}
                      </tbody>
                   </table>
                </div>
             ) : (
                <StandingsView />
             )}
          </div>

          {/* Footer */}
          <div className="bg-slate-950 p-4 border-t border-slate-800 flex justify-end shrink-0">
             {activeTab === 'results' ? (
                 <button
                    onClick={() => setActiveTab('standings')}
                    className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded transition-colors uppercase tracking-widest"
                 >
                    View Standings
                    <ChevronRight size={20} />
                 </button>
             ) : (
                 <button
                    onClick={actions.nextRace}
                    className="flex items-center gap-2 px-6 py-3 bg-race-purple hover:bg-purple-600 text-white font-bold rounded transition-colors uppercase tracking-widest shadow-lg shadow-purple-900/20"
                 >
                    Next Race
                    <Play size={20} />
                 </button>
             )}
          </div>
       </div>
    </div>
  );
};
