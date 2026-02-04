import React from "react";
import { Player } from "@/types";
import { Tactic } from "@/lib/engine/TacticsManager";

interface PracticeSidebarProps {
  teamT: Player[];
  teamCT: Player[];
  selectedPlayerId: string | null;
  onSelectPlayer: (id: string | null) => void;
  overrides: Record<string, Partial<Player["skills"]["mental"] & Player["skills"]["technical"]>>;
  onUpdateOverride: (playerId: string, stat: string, value: number) => void;
  tacticT: Tactic;
  tacticCT: Tactic;
  onTacticChange: (side: "T" | "CT", tactic: Tactic) => void;
  onRandomize: () => void;
}

export const PracticeSidebar: React.FC<PracticeSidebarProps> = ({
  teamT,
  teamCT,
  selectedPlayerId,
  onSelectPlayer,
  overrides,
  onUpdateOverride,
  tacticT,
  tacticCT,
  onTacticChange,
  onRandomize
}) => {

  const getPlayer = (id: string) => {
    return [...teamT, ...teamCT].find(p => p.id === id);
  };

  const selectedPlayer = selectedPlayerId ? getPlayer(selectedPlayerId) : null;

  const renderTeam = (side: "T" | "CT", players: Player[]) => (
    <div className="mb-6">
      <h3 className={`text-lg font-bold mb-2 ${side === "T" ? "text-yellow-500" : "text-blue-500"}`}>
        {side} Side
      </h3>
      <div className="space-y-2">
        {players.map(p => (
          <div
            key={p.id}
            onClick={() => onSelectPlayer(p.id)}
            className={`p-2 border cursor-pointer text-sm flex justify-between items-center
              ${selectedPlayerId === p.id ? "bg-zinc-800 border-white" : "bg-zinc-900 border-zinc-700 hover:border-zinc-500"}
            `}
          >
            <span className="truncate w-32">{p.name}</span>
            <span className="text-xs text-zinc-500">{p.role}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto bg-zinc-950 border-r border-zinc-800 p-4 w-80 flex-shrink-0">
      <h2 className="text-xl font-bold text-white mb-6">Configuration</h2>

      {/* Team Selection */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-zinc-400 font-semibold">Rosters</h3>
          <button
            onClick={onRandomize}
            className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-2 py-1 rounded"
          >
            Randomize
          </button>
        </div>

        {renderTeam("T", teamT)}
        {renderTeam("CT", teamCT)}
      </div>

      {/* Tactics */}
      <div className="mb-8 border-t border-zinc-800 pt-4">
        <h3 className="text-zinc-400 font-semibold mb-4">Tactics</h3>

        <div className="mb-4">
          <label className="block text-xs text-yellow-500 mb-1">T Strategy</label>
          <select
            value={tacticT}
            onChange={(e) => onTacticChange("T", e.target.value as Tactic)}
            className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm p-2"
          >
            <option value="DEFAULT">Default</option>
            <option value="RUSH_A">Rush A</option>
            <option value="RUSH_B">Rush B</option>
            <option value="MID_CONTROL">Mid Control</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-blue-500 mb-1">CT Strategy</label>
          <select
             value={tacticCT}
             onChange={(e) => onTacticChange("CT", e.target.value as Tactic)}
             className="w-full bg-zinc-900 border border-zinc-700 text-white text-sm p-2"
          >
            <option value="DEFAULT">Default (Hold)</option>
            <option value="RUSH_A">Stack A</option>
            <option value="RUSH_B">Stack B</option>
          </select>
        </div>
      </div>

      {/* Player Editor */}
      {selectedPlayer && (
        <div className="border-t border-zinc-800 pt-4 pb-10">
          <h3 className="text-zinc-400 font-semibold mb-2">Editor: <span className="text-white">{selectedPlayer.name}</span></h3>
          <p className="text-xs text-zinc-500 mb-4">Changes apply to next simulation start.</p>

          {/* Aggression Slider */}
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1">
              <span>Aggression</span>
              <span className="text-yellow-400">
                {overrides[selectedPlayer.id]?.aggression ?? selectedPlayer.skills.mental.aggression}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="200"
              value={overrides[selectedPlayer.id]?.aggression ?? selectedPlayer.skills.mental.aggression}
              onChange={(e) => onUpdateOverride(selectedPlayer.id, "aggression", parseInt(e.target.value))}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Shooting Slider */}
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1">
              <span>Shooting</span>
              <span className="text-yellow-400">
                {overrides[selectedPlayer.id]?.shooting ?? selectedPlayer.skills.technical.shooting}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="200"
              value={overrides[selectedPlayer.id]?.shooting ?? selectedPlayer.skills.technical.shooting}
              onChange={(e) => onUpdateOverride(selectedPlayer.id, "shooting", parseInt(e.target.value))}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Reaction Slider */}
           <div className="mb-4">
            <div className="flex justify-between text-xs mb-1">
              <span>Reaction Time</span>
              <span className="text-yellow-400">
                {overrides[selectedPlayer.id]?.reactionTime ?? selectedPlayer.skills.physical.reactionTime}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="200"
              value={overrides[selectedPlayer.id]?.reactionTime ?? selectedPlayer.skills.physical.reactionTime}
              onChange={(e) => onUpdateOverride(selectedPlayer.id, "reactionTime", parseInt(e.target.value))}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>
  );
};
