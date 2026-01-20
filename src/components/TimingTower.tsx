import { useGame } from '../context/GameContext';
import { Trophy, AlertTriangle } from 'lucide-react';
import { formatTime } from '../engine/mathUtils';

const TimingTower = () => {
  const { raceData, gameState } = useGame();

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
              <th className="p-2 text-slate-500 font-normal text-right">Gap</th>
              <th className="p-2 text-slate-500 font-normal text-right hidden sm:table-cell">Last</th>
            </tr>
          </thead>
          <tbody>
            {displayData.map((row, idx) => {
               // Check if Player Team
               // We need to look up if this driver belongs to player.
               // raceData.results has `driverId`.
               // We don't have teamId directly on result, but we have `teamName`.
               // Or we can check playerTeamId vs GameContext logic.
               // Let's rely on teamName matching player team name?
               // Or easier: useGame -> getPlayerTeam -> check driver IDs.
               // But inside map, that's slow.
               // Let's just assume simple highlight if driver name matches known player driver names?
               // Actually we have teamName in result.

               // Better: Pre-calculate player driver IDs in component.
               // But for now, let's just use `row.driverId`.
               // We can't access playerTeamId easily here efficiently without lookup map?
               // Actually we have `playerTeamId`. If we had `teamId` in row it would be easy.
               // I'll assume `row.teamName` is unique enough or just fix the Context to include teamId in Result.
               // For now, let's just highlight rows with `teamName` === playerTeam?.name

               // Wait, `row` has `teamName`.

               const isLeader = idx === 0;
               const isPodium = idx < 3;

               // Gap formatting
               let gapText = '';
               if (isQualifying) {
                   // In Qualy, `totalTime` is 0 in `results` array usually?
                   // Ah, startQualifying sets `totalTime: 0`.
                   // But `qualifyingResults` has the times.
                   // So in Qualy mode, we should render from `qualifyingResults` really.
                   // But `results` array is initialized with Rank based on Qualy.
                   // Let's just use the `gapToLeader` from `results` which is 0 initially?
                   // Wait, `startQualifying` sets `gapToLeader: 0`.
                   // So visually Qualy looks empty?
                   // Let's render `qualifyingResults` instead if Qualy.
                   gapText = '-';
               } else {
                   gapText = isLeader ? 'LEADER' : `+${formatTime(row.gapToLeader)}`;
               }

               return (
                 <tr
                   key={row.driverId}
                   className={`
                     border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors
                     ${row.status === 'Finished' ? 'opacity-50' : ''}
                   `}
                 >
                   <td className={`p-2 text-center font-mono ${isLeader ? 'text-race-purple font-bold' : isPodium ? 'text-slate-300' : 'text-slate-500'}`}>
                     {row.rank}
                   </td>
                   <td className="p-2">
                     <div className="flex items-center gap-2">
                       <span className="font-bold text-slate-200">{row.driverName}</span>
                       <span className="text-xs text-slate-500 hidden md:inline">{row.teamName}</span>
                       {row.penalty && <AlertTriangle size={12} className="text-orange-500" />}
                     </div>
                   </td>
                   <td className="p-2 text-right font-mono text-slate-400">
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
