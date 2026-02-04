import React, { useRef, useEffect } from "react";
import { Tactic, TeamSide } from "@/lib/engine/TacticsManager";

interface SimulationControlsProps {
  isRunning: boolean;
  tickCount: number;
  tSideTactic: Tactic;
  ctSideTactic: Tactic;
  events: string[];
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  onTacticChange: (side: TeamSide, tactic: Tactic) => void;
}

const TACTICS: Tactic[] = ["DEFAULT", "RUSH_A", "RUSH_B", "MID_CONTROL"];

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  isRunning,
  tickCount,
  tSideTactic,
  ctSideTactic,
  events,
  onStart,
  onStop,
  onReset,
  onTacticChange,
}) => {
  const logRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col gap-4 w-full h-full bg-zinc-900 p-4 border border-zinc-700">
      {/* Header / Stats */}
      <div className="flex justify-between items-center border-b border-zinc-700 pb-4">
        <h2 className="text-xl font-bold text-white uppercase tracking-wider">
          Match Simulation
        </h2>
        <div className="font-mono text-zinc-400">
          Tick: <span className="text-white">{tickCount}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {!isRunning ? (
          <button
            onClick={onStart}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-none uppercase text-sm"
          >
            Start
          </button>
        ) : (
          <button
            onClick={onStop}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-none uppercase text-sm"
          >
            Pause
          </button>
        )}
        <button
          onClick={onReset}
          className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 px-4 rounded-none uppercase text-sm"
        >
          Reset
        </button>
      </div>

      {/* Tactics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-yellow-500 font-bold uppercase">TERRORIST TACTIC</label>
          <select
            value={tSideTactic}
            onChange={(e) => onTacticChange("T", e.target.value as Tactic)}
            className="bg-zinc-800 text-white border border-zinc-600 p-2 text-sm rounded-none focus:border-yellow-500 outline-none"
          >
            {TACTICS.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-blue-500 font-bold uppercase">CT TACTIC</label>
          <select
            value={ctSideTactic}
            onChange={(e) => onTacticChange("CT", e.target.value as Tactic)}
            className="bg-zinc-800 text-white border border-zinc-600 p-2 text-sm rounded-none focus:border-blue-500 outline-none"
          >
            {TACTICS.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Event Log */}
      <div className="flex-1 overflow-hidden flex flex-col mt-2">
        <h3 className="text-xs text-zinc-500 font-bold uppercase mb-2">Event Log</h3>
        <div
          ref={logRef}
          className="flex-1 overflow-y-auto bg-black/50 p-2 font-mono text-xs border border-zinc-800"
        >
          {events.length === 0 && (
            <div className="text-zinc-600 italic">No events yet...</div>
          )}
          {events.map((event, i) => (
            <div key={i} className="mb-1 text-zinc-300 border-b border-zinc-900/50 pb-1 last:border-0">
              {event}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
