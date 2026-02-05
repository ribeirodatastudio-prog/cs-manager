import React, { useState } from "react";
import { Player } from "@/types";
import { Users, Shuffle, ArrowRight, Settings2, X } from "lucide-react";

interface RosterSelectionProps {
  teamT: Player[];
  teamCT: Player[];
  overrides: Record<string, Record<string, number>>;
  onUpdateOverride: (playerId: string, stat: string, value: number) => void;
  onRandomize: () => void;
  onNext: () => void;
}

export const RosterSelection: React.FC<RosterSelectionProps> = ({
  teamT,
  teamCT,
  overrides,
  onUpdateOverride,
  onRandomize,
  onNext,
}) => {
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);

  const getPlayer = (id: string) => {
    return [...teamT, ...teamCT].find((p) => p.id === id);
  };

  const editingPlayer = editingPlayerId ? getPlayer(editingPlayerId) : null;

  const renderPlayerCard = (player: Player, side: "T" | "CT") => (
    <div
      key={player.id}
      onClick={() => setEditingPlayerId(player.id)}
      className={`group relative p-4 border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 transition-all cursor-pointer flex items-center justify-between ${
        side === "T" ? "hover:border-yellow-500/50" : "hover:border-blue-500/50"
      }`}
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 flex items-center justify-center font-bold text-lg bg-zinc-950 border ${side === "T" ? "border-yellow-900 text-yellow-500" : "border-blue-900 text-blue-500"}`}>
            {player.name.charAt(0)}
        </div>
        <div>
           <div className="font-bold text-zinc-200 group-hover:text-white">{player.name}</div>
           <div className="text-xs text-zinc-500 uppercase tracking-wider">{player.role}</div>
        </div>
      </div>
      <Settings2 className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white relative">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-900">
        <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-zinc-400" />
            <h1 className="text-2xl font-bold tracking-tight">Roster Selection</h1>
        </div>
        <div className="flex gap-4">
             <button
              onClick={onRandomize}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-800 transition-colors"
            >
              <Shuffle className="w-4 h-4" />
              Randomize Teams
            </button>
            <button
              onClick={onNext}
              className="flex items-center gap-2 px-6 py-2 bg-white text-black font-bold hover:bg-zinc-200 rounded transition-colors"
            >
              Next Step
              <ArrowRight className="w-4 h-4" />
            </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-2 gap-8 p-8 overflow-y-auto">
        {/* T Side */}
        <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-yellow-500/20 pb-2 mb-6">
                <h2 className="text-xl font-bold text-yellow-500">Terrorist Side</h2>
                <span className="text-xs font-mono text-yellow-500/50">TEAM A</span>
            </div>
            <div className="grid gap-3">
                {teamT.map(p => renderPlayerCard(p, "T"))}
            </div>
        </div>

        {/* CT Side */}
        <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-blue-500/20 pb-2 mb-6">
                <h2 className="text-xl font-bold text-blue-500">Counter-Terrorist Side</h2>
                <span className="text-xs font-mono text-blue-500/50">TEAM B</span>
            </div>
             <div className="grid gap-3">
                {teamCT.map(p => renderPlayerCard(p, "CT"))}
            </div>
        </div>
      </div>

      {/* Player Editor Modal */}
      {editingPlayer && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 w-full max-w-md shadow-2xl">
             <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950">
                <h3 className="font-bold text-lg flex items-center gap-2">
                    Editing <span className="text-white">{editingPlayer.name}</span>
                </h3>
                <button onClick={() => setEditingPlayerId(null)} className="text-zinc-500 hover:text-white">
                    <X className="w-5 h-5" />
                </button>
             </div>

             <div className="p-6 space-y-6">
                <div className="space-y-4">
                     {/* Aggression */}
                    <div>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-zinc-400">Aggression</span>
                            <span className="font-mono text-yellow-500">
                                {overrides[editingPlayer.id]?.aggression ?? editingPlayer.skills.mental.aggression}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="200"
                            value={overrides[editingPlayer.id]?.aggression ?? editingPlayer.skills.mental.aggression}
                            onChange={(e) => onUpdateOverride(editingPlayer.id, "aggression", parseInt(e.target.value))}
                            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                        />
                    </div>

                    {/* Shooting */}
                    <div>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-zinc-400">Shooting Skill</span>
                            <span className="font-mono text-blue-500">
                                {overrides[editingPlayer.id]?.shooting ?? editingPlayer.skills.technical.shooting}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="200"
                            value={overrides[editingPlayer.id]?.shooting ?? editingPlayer.skills.technical.shooting}
                            onChange={(e) => onUpdateOverride(editingPlayer.id, "shooting", parseInt(e.target.value))}
                            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>

                    {/* Reaction Time */}
                    <div>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="text-zinc-400">Reaction Time (ms)</span>
                            <span className="font-mono text-green-500">
                                {overrides[editingPlayer.id]?.reactionTime ?? editingPlayer.skills.physical.reactionTime}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="200"
                            value={overrides[editingPlayer.id]?.reactionTime ?? editingPlayer.skills.physical.reactionTime}
                            onChange={(e) => onUpdateOverride(editingPlayer.id, "reactionTime", parseInt(e.target.value))}
                            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-green-500"
                        />
                    </div>
                </div>

                <div className="pt-4 border-t border-zinc-800 flex justify-end">
                    <button
                        onClick={() => setEditingPlayerId(null)}
                        className="px-4 py-2 bg-white text-black font-bold text-sm hover:bg-zinc-200"
                    >
                        Done
                    </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
