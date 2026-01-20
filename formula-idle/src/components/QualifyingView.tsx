import { useGame } from '../context/GameContext';

export const QualifyingView = () => {
  const { raceData, grid, actions } = useGame();

  const fmt = (n: number) => n.toFixed(3);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-cyan-400 p-4 font-mono overflow-auto">
      <div className="flex justify-between items-center mb-4 border-b border-cyan-700 pb-2">
        <h2 className="text-2xl">QUALIFYING RESULTS</h2>
        <button
          onClick={actions.startRace}
          className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded uppercase font-bold shadow-lg"
        >
          Start Race
        </button>
      </div>

      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="text-cyan-200 border-b border-cyan-800">
             <th className="p-2">Pos</th>
             <th className="p-2">Driver</th>
             <th className="p-2">Team</th>
             <th className="p-2 text-right">S1</th>
             <th className="p-2 text-right">S2</th>
             <th className="p-2 text-right">S3</th>
             <th className="p-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {raceData.qualifyingResults.map((res, idx) => {
             const driver = grid.flatMap(t => t.drivers).find(d => d.id === res.driverId);
             const team = grid.find(t => t.id === driver?.teamId);

             return (
               <tr key={res.driverId} className="border-b border-gray-800 hover:bg-gray-800">
                 <td className="p-2">{idx + 1}</td>
                 <td className="p-2 text-white">{driver?.name}</td>
                 <td className="p-2 text-gray-500">{team?.name}</td>
                 <td className="p-2 text-right text-yellow-500">{fmt(res.sectors[0])}</td>
                 <td className="p-2 text-right text-blue-500">{fmt(res.sectors[1])}</td>
                 <td className="p-2 text-right text-red-500">{fmt(res.sectors[2])}</td>
                 <td className="p-2 text-right font-bold text-cyan-300">{fmt(res.time)}</td>
               </tr>
             );
          })}
        </tbody>
      </table>
    </div>
  );
};
