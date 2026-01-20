import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { formatTime } from '../engine/mathUtils';
import { Trophy, ChevronRight, Play, TrendingUp, Activity, FileText } from 'lucide-react';

export const PostRaceSummary = () => {
  const { raceData, season, grid, actions, turnReport, playerTeamId } = useGame();
  const [activeTab, setActiveTab] = useState<'results' | 'standings' | 'report'>('results');

  const { results } = raceData;

  // Calculate Fastest Lap
  let fastestLapTime = Infinity;
  let fastestDriverId: string | null = null;
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

  const ReportView = () => {
      const playerTeam = grid.find(t => t.id === playerTeamId);

      let totalEarnings = 0;
      results.forEach(r => {
          let pts = (41 - r.rank) / 10;
          if (pts < 0.1) pts = 0.1;
          if (r.driverId === fastestDriverId) pts += 0.1;

          if (playerTeam?.drivers.some(d => d.id === r.driverId)) {
              totalEarnings += pts;
          }
      });
      // Round for display
      totalEarnings = Math.round(totalEarnings * 100) / 100;

      return (
         <div className="flex gap-4 h-full overflow-hidden">
             {/* Financials */}
             <div className="flex-1 flex flex-col bg-slate-900/50 rounded border border-slate-800 p-6">
                 <div className="flex items-center gap-3 mb-6">
                    <TrendingUp className="text-emerald-400" size={28} />
                    <h3 className="text-xl font-bold text-slate-200">FINANCIAL REPORT</h3>
                 </div>

                 <div className="space-y-4">
                     <div className="p-4 bg-slate-950/50 rounded border border-slate-800 flex justify-between items-center">
                         <span className="text-slate-400 font-mono">RACE EARNINGS</span>
                         <span className="text-2xl font-bold text-emerald-400 font-mono">+{totalEarnings.toFixed(2)} pts</span>
                     </div>
                     <p className="text-sm text-slate-500 italic">
                        Earnings are calculated based on driver finishing positions. Higher ranks yield significantly more R&D points.
                     </p>
                 </div>
             </div>

             {/* Rumors */}
             <div className="flex-[2] flex flex-col bg-slate-900/50 rounded border border-slate-800 overflow-hidden">
                 <div className="p-4 border-b border-slate-800 flex items-center gap-3">
                    <Activity className="text-race-gold" size={24} />
                    <h3 className="font-bold text-slate-200">PADDOCK RUMORS</h3>
                 </div>
                 <div className="flex-1 overflow-y-auto p-4 space-y-2">
                     {turnReport.length === 0 ? (
                         <div className="text-slate-500 text-center italic mt-10">The paddock is quiet...</div>
                     ) : (
                         turnReport.map((log, i) => {
                             // Simple coloring based on content
                             let colorClass = "text-slate-300";
                             if (log.includes("Breakthrough") || log.includes("Game Changer")) colorClass = "text-purple-400 font-bold";
                             if (log.includes("Failure")) colorClass = "text-red-400";
                             if (log.includes("Minor Upgrade")) colorClass = "text-emerald-400/80";

                             return (
                                 <div key={i} className={`p-3 bg-slate-950/30 rounded border border-slate-800/50 font-mono text-sm ${colorClass}`}>
                                     {log}
                                 </div>
                             );
                         })
                     )}
                 </div>
             </div>
         </div>
      );
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
                <button
                   onClick={() => setActiveTab('report')}
                   className={`px-4 py-1 rounded text-sm font-bold transition-colors ${activeTab === 'report' ? 'bg-race-purple text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                   REPORT
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
                         {results.map((r) => {
                            const isFastest = r.driverId === fastestDriverId;
                            // Display Championship Points
                            const champPts = (41 - r.rank) + (isFastest ? 0.1 : 0);

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
                                  <td className="p-3 text-right font-mono font-bold text-race-gold">
                                     +{champPts.toFixed(1)}
                                  </td>
                               </tr>
                            );
                         })}
                      </tbody>
                   </table>
                </div>
             ) : activeTab === 'standings' ? (
                <StandingsView />
             ) : (
                <ReportView />
             )}
          </div>

          {/* Footer */}
          <div className="bg-slate-950 p-4 border-t border-slate-800 flex justify-end shrink-0">
             {activeTab === 'results' && (
                 <button
                    onClick={() => setActiveTab('standings')}
                    className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded transition-colors uppercase tracking-widest"
                 >
                    View Standings
                    <ChevronRight size={20} />
                 </button>
             )}

             {activeTab === 'standings' && (
                 <button
                    onClick={() => setActiveTab('report')}
                    className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded transition-colors uppercase tracking-widest"
                 >
                    Season Report
                    <FileText size={20} />
                 </button>
             )}

             {activeTab === 'report' && (
                 <button
                    onClick={actions.nextRace}
                    className="flex items-center gap-2 px-6 py-3 bg-race-purple hover:bg-purple-600 text-white font-bold rounded transition-colors uppercase tracking-widest shadow-lg shadow-purple-900/20"
                 >
                    Go to Garage
                    <Play size={20} />
                 </button>
             )}
          </div>
       </div>
    </div>
  );
};
