import { useGame } from '../context/GameContext';
import { Trophy, AlertTriangle } from 'lucide-react';
import { formatTime } from '../engine/mathUtils';

const TimingTower = () => {
  const { raceData, gameState, grid, playerTeamId } = useGame();

  // Decide what to show
  // If QUALIFYING, show qualifyingResults (needs to be mapped to drivers).
  // If RACE or RESULTS, show raceData.results.

  const isQualifying = gameState === 'QUALIFYING';

  // If we are in HQ, maybe show nothing or previous results?
  // Let's show results if they exist.

  const displayData = [...raceData.results].sort((a, b) => a.rank - b.rank);

  if (displayData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-500">
           <Trophy size={48} className="mb-4 opacity-20" />
           <span className="uppercase tracking-widest text-sm">Awaiting Session Data</span>
        </div>
      );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
      <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex justify-between items-center shrink-0">
         <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {isQualifying ? 'Qualifying Session' : `Lap ${raceData.currentLap}`}
         </span>
         {raceData.isRaceFinished && <span className="text-xs text-race-purple font-bold px-2 py-0.5 bg-race-purple/10 rounded">FINISHED</span>}
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-900 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="p-2 text-slate-500 font-normal w-12 text-center">Pos</th>
              <th className="p-2 text-slate-500 font-normal">Driver</th>
              <th className="p-2 text-slate-500 font-normal text-right">Interval</th>
              <th className="p-2 text-slate-500 font-normal text-right hidden sm:table-cell">Last</th>
            </tr>
          </thead>
          <tbody>
            {displayData.map((row, idx) => {
               const driver = grid.flatMap(t => t.drivers).find(d => d.id === row.driverId);
               const isPlayer = driver?.teamId === playerTeamId;

               const isLeader = idx === 0;
               const isPodium = idx < 3;

               // Gap formatting
               let gapText = '';
               if (isQualifying) {
                   gapText = '-';
               } else {
                   gapText = isLeader ? 'INTERVAL' : `+${formatTime(row.gapToAhead)}`;
               }

               let rowClasses = "border-b border-slate-800/50 transition-colors ";
               if (row.status === 'Finished') rowClasses += "opacity-50 ";

               if (isPlayer) {
                   rowClasses += "bg-yellow-900/20 text-yellow-400 border-l-4 border-yellow-500 hover:bg-yellow-900/30 ";
               } else {
                   rowClasses += "hover:bg-slate-800/50 ";
               }

               return (
                 <tr
                   key={row.driverId}
                   className={rowClasses}
                 >
                   <td className={`p-2 text-center font-mono ${isLeader ? 'text-race-purple font-bold' : isPodium ? 'text-slate-300' : isPlayer ? 'text-yellow-400' : 'text-slate-500'}`}>
                     {row.rank}
                   </td>
                   <td className="p-2">
                     <div className="flex items-center gap-2">
                       <span className="text-lg">{row.flag}</span>
                       <span className={`font-bold ${isPlayer ? 'text-yellow-400' : 'text-slate-200'}`}>{row.driverName}</span>
                       <span className={`text-xs hidden md:inline ${isPlayer ? 'text-yellow-400/70' : 'text-slate-500'}`}>{row.teamName}</span>
                       {row.penalty && <AlertTriangle size={12} className="text-orange-500" />}
                     </div>
                   </td>
                   <td className={`p-2 text-right font-mono ${isPlayer ? 'text-yellow-400' : 'text-slate-400'}`}>
                     {gapText}
                   </td>
                   <td className="p-2 text-right font-mono text-slate-500 hidden sm:table-cell">
                     {row.lastLapTime > 0 ? formatTime(row.lastLapTime) : '-'}
                   </td>
                 </tr>
               );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TimingTower;
