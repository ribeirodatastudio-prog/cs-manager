import { useGame } from '../context/GameContext';
import { Radio } from 'lucide-react';

export const TeamRadioFeed = () => {
  const { teamRadio } = useGame();

  return (
    <div className="flex flex-col h-full bg-slate-950 border-l border-slate-800 font-mono text-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center gap-2 bg-slate-900/50">
         <Radio size={16} className="text-sky-400" />
         <h3 className="text-sm font-bold text-white tracking-wider uppercase">Team Radio</h3>
      </div>

      {/* Feed List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
         {teamRadio.length === 0 ? (
            <div className="text-gray-500 italic text-center mt-10">
               No radio chatter yet...
            </div>
         ) : (
            teamRadio.map((msg) => (
               <div key={msg.id} className="flex gap-3 bg-slate-900/30 p-2 rounded border border-slate-800/50 animate-in fade-in slide-in-from-top-2 duration-300">
                  {/* Status Indicator */}
                  <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                     msg.type === 'positive' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                     msg.type === 'negative' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                     'bg-slate-400'
                  }`} />

                  <div className="flex-1">
                     <div className="flex justify-between items-baseline mb-1">
                        <span className="font-bold text-slate-200">{msg.driverName}</span>
                        <span className="text-[10px] text-slate-600">Lap {msg.lap}</span>
                     </div>
                     <div className={`${
                        msg.type === 'positive' ? 'text-green-300' :
                        msg.type === 'negative' ? 'text-red-300' :
                        'text-slate-400'
                     }`}>
                        {msg.message}
                     </div>
                  </div>
               </div>
            ))
         )}
      </div>
    </div>
  );
};
