import React from "react";

export const CombatLog: React.FC<{ logs: string[] }> = ({ logs }) => {
  return (
    <div className="bg-black border border-zinc-800 h-full overflow-y-auto p-4 font-mono text-xs text-zinc-300 shadow-inner">
        <h3 className="text-zinc-500 font-bold mb-2 sticky top-0 bg-black py-1 border-b border-zinc-800">Combat Log</h3>
        {logs.length === 0 && <span className="text-zinc-600 italic">No events yet...</span>}
        {logs.map((log, i) => (
            <div key={i} className={`mb-1 pb-1 border-b border-zinc-900/50 last:border-0 ${log.startsWith("   >") ? "text-zinc-500 pl-4" : "text-zinc-300"}`}>
                {log}
            </div>
        ))}
    </div>
  );
};
