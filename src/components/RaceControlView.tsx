import { useGame } from '../context/GameContext';
import { formatTime } from '../engine/mathUtils';

interface Props {
  onSelectDriver: (driverId: string) => void;
  selectedDriverId: string | null;
}

export const RaceControlView = ({ onSelectDriver, selectedDriverId }: Props) => {
  const { raceData, grid, currentTrack, actions, playerTeamId } = useGame();

  const isFinished = raceData.isRaceFinished;

  return (
    <div className="flex flex-col h-full bg-gray-900 text-cyan-400 p-4 font-mono">
       <div className="flex justify-between items-center mb-4 border-b border-cyan-700 pb-2">
          <h2 className="text-2xl">
             RACE - LAP {raceData.currentLap} / {currentTrack?.laps}
          </h2>
          <div className="space-x-4">
             {isFinished && (
                <button
                  onClick={actions.nextRace}
                  className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded uppercase font-bold shadow-lg"
                >
                  Next Season Event
                </button>
             )}
          </div>
       </div>

       {/* Race Grid / Standings */}
       <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse text-sm">
             <thead>
                <tr className="text-cyan-200 border-b border-cyan-800">
                   <th className="p-2">Pos</th>
                   <th className="p-2">Driver</th>
                   <th className="p-2">Team</th>
                   <th className="p-2 text-right">Last Lap</th>
                   <th className="p-2 text-right">Gap</th>
                   <th className="p-2 text-right">Interval</th>
                   <th className="p-2 text-center">St</th>
                </tr>
             </thead>
             <tbody>
               {raceData.results.map((res) => {
                   const driver = grid.flatMap(t => t.drivers).find(d => d.id === res.driverId);
                   const isSelected = selectedDriverId === res.driverId;
                   const isPlayer = driver?.teamId === playerTeamId;

                   let rowClass = "border-b border-gray-800 cursor-pointer transition-colors ";
                   if (isSelected) {
                       rowClass += "bg-cyan-900 text-white ";
                       if (isPlayer) rowClass += "border-l-4 border-yellow-500 ";
                   } else if (isPlayer) {
                       rowClass += "bg-yellow-900/20 text-yellow-400 border-l-4 border-yellow-500 hover:bg-yellow-900/30 ";
                   } else {
                       rowClass += "hover:bg-gray-800 ";
                   }

                   return (
                     <tr
                       key={res.driverId}
                       className={rowClass}
                       onClick={() => onSelectDriver(res.driverId)}
                     >
                       <td className="p-2">{res.rank}</td>
                       <td className={`p-2 font-bold ${isSelected ? 'text-white' : isPlayer ? 'text-yellow-400' : 'text-gray-200'}`}>{driver?.name}</td>
                       <td className={`p-2 ${isSelected ? 'text-gray-300' : isPlayer ? 'text-yellow-400/70' : 'text-gray-500'}`}>{res.teamName}</td>
                       <td className="p-2 text-right font-mono text-yellow-500">{formatTime(res.lastLapTime)}</td>
                       <td className="p-2 text-right font-mono text-cyan-300">{res.gapToLeader > 0 ? `+${formatTime(res.gapToLeader)}` : 'LEADER'}</td>
                       <td className="p-2 text-right font-mono text-cyan-300">{res.rank === 1 ? 'INTERVAL' : `+${formatTime(res.gapToAhead)}`}</td>
                       <td className="p-2 text-center">{res.status === 'Finished' ? '🏁' : '🟢'}</td>
                     </tr>
                   );
               })}
             </tbody>
          </table>
       </div>
    </div>
  );
};
