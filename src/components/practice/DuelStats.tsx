import React, { useState, useEffect } from "react";
import { Player } from "@/types";
import { PlayerStats } from "@/lib/engine/MatchSimulator";
import { DuelEngine } from "@/lib/engine/DuelEngine";
import { Bot } from "@/lib/engine/Bot";

interface DuelStatsProps {
  stats: Record<string, PlayerStats>;
  players: Player[];
}

export const DuelStats: React.FC<DuelStatsProps> = ({ stats, players }) => {
  const [activeTab, setActiveTab] = useState<"LIVE" | "CALC">("LIVE");

  // Calculator State
  const [calcP1Id, setCalcP1Id] = useState<string>("");
  const [calcP2Id, setCalcP2Id] = useState<string>("");

  // Initialize selection when players load
  useEffect(() => {
    if (players.length > 0) {
        if (!calcP1Id || !players.find(p => p.id === calcP1Id)) {
            setCalcP1Id(players[0].id);
        }
        if (!calcP2Id || !players.find(p => p.id === calcP2Id)) {
            if (players.length > 1) {
                setCalcP2Id(players[1].id);
            }
        }
    }
  }, [players, calcP1Id, calcP2Id]);

  // Calculator Logic
  const renderCalculator = () => {
    const p1 = players.find(p => p.id === calcP1Id);
    const p2 = players.find(p => p.id === calcP2Id);

    return (
      <div className="p-4 bg-zinc-900 border border-zinc-800 mt-2">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <select
            className="bg-black border border-zinc-700 p-1 text-sm text-yellow-500 w-full"
            value={calcP1Id} onChange={e => setCalcP1Id(e.target.value)}
          >
            <option value="">Select Player 1</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select
             className="bg-black border border-zinc-700 p-1 text-sm text-blue-500 w-full"
             value={calcP2Id} onChange={e => setCalcP2Id(e.target.value)}
          >
            <option value="">Select Player 2</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {(!p1 || !p2) ? (
            <div className="text-zinc-500 text-center py-4">Select two players to compare</div>
        ) : (() => {
            // 1. Skill Ratio (Simple Sum of relevant skills)
            const score1 = p1.skills.technical.shooting + p1.skills.physical.reactionTime;
            const score2 = p2.skills.technical.shooting + p2.skills.physical.reactionTime;
            const totalScore = score1 + score2;
            const ratio1 = totalScore > 0 ? (score1 / totalScore) * 100 : 50;

            // 2. Monte Carlo
            const b1 = new Bot(p1, "T", "temp");
            const b2 = new Bot(p2, "CT", "temp");
            const mc = DuelEngine.getWinProbability(b1, b2, 100);

            // 3. Aim Delta
            const aimDelta = p1.skills.technical.crosshairPlacement - p2.skills.mental.positioning;

            return (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-zinc-800 pb-2">
                    <span className="text-zinc-400">Option 1: Skill Ratio (Shoot+React)</span>
                    <span className="font-mono text-white">{ratio1.toFixed(1)}% vs {(100-ratio1).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-800 pb-2">
                     <span className="text-zinc-400">Option 2: Monte Carlo (100 runs)</span>
                     <span className="font-mono text-green-400">{(mc.initiatorWinRate * 100).toFixed(1)}% vs {(mc.targetWinRate * 100).toFixed(1)}%</span>
                  </div>
                   <div className="flex justify-between">
                     <span className="text-zinc-400">Option 3: Aim Delta (CP vs Pos)</span>
                     <span className={`font-mono ${aimDelta > 0 ? "text-green-400" : "text-red-400"}`}>
                        {aimDelta > 0 ? "+" : ""}{aimDelta}
                     </span>
                  </div>
                </div>
            );
        })()}
      </div>
    );
  };

  const renderLiveStats = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs text-zinc-300">
        <thead className="bg-zinc-900 uppercase font-bold text-zinc-500">
          <tr>
            <th className="p-2">Player</th>
            <th className="p-2 text-right">Kills</th>
            <th className="p-2 text-right">Exp. Kills</th>
            <th className="p-2 text-right">Diff</th>
            <th className="p-2 text-right">Dmg</th>
          </tr>
        </thead>
        <tbody>
          {players.map(p => {
            const s = stats[p.id] || { kills: 0, expectedKills: 0, damageDealt: 0 };
            const diff = s.kills - s.expectedKills;
            return (
              <tr key={p.id} className="border-b border-zinc-800 hover:bg-zinc-900/50">
                <td className="p-2 font-medium truncate max-w-[100px]">{p.name}</td>
                <td className="p-2 text-right text-white">{s.kills}</td>
                <td className="p-2 text-right text-zinc-400">{s.expectedKills.toFixed(2)}</td>
                <td className={`p-2 text-right font-bold ${diff >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {diff > 0 ? "+" : ""}{diff.toFixed(2)}
                </td>
                <td className="p-2 text-right text-zinc-500">{Math.round(s.damageDealt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-black border border-zinc-800">
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab("LIVE")}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider ${activeTab === "LIVE" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          Live Match Stats
        </button>
        <button
          onClick={() => setActiveTab("CALC")}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider ${activeTab === "CALC" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          Duel Calculator
        </button>
      </div>

      <div className="flex-1 overflow-auto p-0">
        {activeTab === "LIVE" ? renderLiveStats() : renderCalculator()}
      </div>
    </div>
  );
};
