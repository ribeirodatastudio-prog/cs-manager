import { useGame } from '../context/GameContext';

interface Props {
  driverId: string | null;
}

export const DebugInspector = ({ driverId }: Props) => {
  const { debugData, grid } = useGame();

  if (!driverId) {
    return (
      <div className="p-4 text-gray-500 font-mono italic">
        Select a driver from the grid to inspect telemetry.
      </div>
    );
  }

  const analysis = debugData[driverId];
  const driver = grid.flatMap(t => t.drivers).find(d => d.id === driverId);

  if (!analysis) {
     return (
       <div className="p-4 text-gray-500 font-mono">
         <h3 className="text-xl text-white mb-2 border-b border-gray-700 pb-1">{driver?.name}</h3>
         <div>No telemetry data available yet.</div>
         <div className="text-xs mt-2">Simulate a lap to generate data.</div>
       </div>
     );
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 text-green-400 p-4 font-mono text-xs overflow-auto border-l border-gray-800 w-full">
       <h3 className="text-xl text-white mb-4 border-b border-green-800 pb-1 uppercase tracking-wider">
         Telemetry: <span className="text-cyan-400">{driver?.name}</span>
       </h3>

       <div className="mb-6 bg-gray-900 p-3 rounded border border-gray-800">
         <h4 className="text-white font-bold mb-2 border-b border-gray-700 pb-1">LAP SUMMARY</h4>
         <div className="grid grid-cols-2 gap-y-1">
           <div className="text-gray-400">Raw Pace:</div><div className="text-right text-green-300">{analysis.baseTime.toFixed(3)}s</div>
           <div className="text-gray-400">Variance:</div><div className="text-right text-blue-300">{analysis.variance > 0 ? "+" : ""}{analysis.variance.toFixed(3)}s</div>
           <div className="text-gray-100 font-bold border-t border-gray-700 mt-1 pt-1">FINAL TIME:</div><div className="text-right text-yellow-400 font-bold border-t border-gray-700 mt-1 pt-1 text-lg">{analysis.finalTime.toFixed(3)}s</div>
         </div>
       </div>

       <div className="mb-6">
         <h4 className="text-white font-bold mb-2 border-b border-gray-700 pb-1">MODIFIERS</h4>
         <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Instincts:</span>
              <span className="text-white">{analysis.modifiers.instincts}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Traffic Status:</span>
              <span className={`font-bold ${analysis.modifiers.traffic ? "text-red-500" : "text-green-500"}`}>
                {analysis.modifiers.traffic ? "STUCK (+15%)" : "CLEAN AIR"}
              </span>
            </div>
            {analysis.modifiers.overtake && (
                <div className="flex flex-col mt-2 p-2 bg-gray-900 border border-gray-700 rounded">
                   <span className="text-gray-400 mb-1">Overtake Attempt:</span>
                   <span className="text-cyan-300 font-bold">{analysis.modifiers.overtake}</span>
                </div>
            )}
         </div>
       </div>

       <div>
         <h4 className="text-white font-bold mb-2 border-b border-gray-700 pb-1">SEGMENT BREAKDOWN</h4>
         <div className="space-y-2 mt-2">
            {analysis.segments.map((seg, idx) => (
               <div key={idx} className="bg-gray-900 p-2 rounded border border-gray-800 hover:border-gray-600 transition-colors">
                  <div className="flex justify-between text-white font-bold mb-1">
                     <span className="text-gray-300">{idx+1}. {seg.type.replace(/([A-Z])/g, ' $1').trim()}</span>
                     <span className="text-green-400">{seg.result.toFixed(3)}s</span>
                  </div>
                  <div className="text-gray-500 text-[10px] flex justify-between">
                     <span>Base: {seg.base}s</span>
                     <span>Score: {seg.score.toFixed(0)}</span>
                  </div>
               </div>
            ))}
         </div>
       </div>
    </div>
  );
};
