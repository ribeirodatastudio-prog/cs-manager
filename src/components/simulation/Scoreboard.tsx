import React from "react";
import { MatchState, MatchPhase } from "@/lib/engine/types";
import { BombState } from "@/lib/engine/MatchSimulator";
import { Bot } from "@/lib/engine/Bot";
import { ECONOMY } from "@/lib/engine/constants";

interface ScoreboardProps {
  matchState: MatchState;
  bombState: BombState;
  roundTimer: number;
  bots: Bot[];
}

export const Scoreboard: React.FC<ScoreboardProps> = ({
  matchState,
  bombState,
  roundTimer,
  bots,
}) => {
  // Calculate Team Economy
  const tEconomy = bots
    .filter((b) => b.side === "T")
    .reduce((sum, b) => sum + (b.player.inventory?.money || 0), 0);
  const ctEconomy = bots
    .filter((b) => b.side === "CT")
    .reduce((sum, b) => sum + (b.player.inventory?.money || 0), 0);

  // Format Timer
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Determine Timer Color
  let timerColor = "text-white";
  if (bombState.isPlanted) timerColor = "text-red-500 animate-pulse";
  else if (roundTimer < 10) timerColor = "text-red-500";
  else if (matchState.phase === MatchPhase.FREEZETIME) timerColor = "text-green-500";

  return (
    <div className="w-full bg-zinc-900 border-b border-zinc-700 flex flex-col mb-4">
      {/* Top Bar: Scores & Timer */}
      <div className="flex h-16 w-full">
        {/* CT Side */}
        <div className="flex-1 bg-gradient-to-r from-blue-900/40 to-transparent flex items-center justify-between px-6 border-r border-zinc-800">
            <div className="flex flex-col">
                <span className="text-blue-400 font-bold text-lg">COUNTER-TERRORISTS</span>
                <span className="text-zinc-400 text-xs flex gap-2">
                   <span>$$ {ctEconomy.toLocaleString()}</span>
                   <span>Loss Bonus: Level {matchState.lossBonus.CT}</span>
                </span>
            </div>
            <span className="text-4xl font-bold text-white font-mono">{matchState.scores.CT}</span>
        </div>

        {/* Center: Timer & Round */}
        <div className="w-32 bg-black flex flex-col items-center justify-center border-x border-zinc-800 shrink-0">
             <div className="text-xs text-zinc-500 font-bold uppercase">Round {matchState.round}</div>
             <div className={`text-2xl font-bold font-mono ${timerColor}`}>
                 {formatTime(matchState.phase === MatchPhase.FREEZETIME ? matchState.phaseTimer : roundTimer)}
             </div>
             {matchState.phase === MatchPhase.FREEZETIME && (
                 <div className="text-[10px] text-green-500 uppercase">Buy Phase</div>
             )}
             {bombState.isPlanted && (
                 <div className="text-[10px] text-red-500 uppercase">BOMB PLANTED</div>
             )}
        </div>

        {/* T Side */}
        <div className="flex-1 bg-gradient-to-l from-yellow-900/40 to-transparent flex items-center justify-between px-6 border-l border-zinc-800">
            <span className="text-4xl font-bold text-white font-mono">{matchState.scores.T}</span>
            <div className="flex flex-col items-end">
                <span className="text-yellow-400 font-bold text-lg">TERRORISTS</span>
                <span className="text-zinc-400 text-xs flex gap-2">
                   <span>Loss Bonus: Level {matchState.lossBonus.T}</span>
                   <span>$$ {tEconomy.toLocaleString()}</span>
                </span>
            </div>
        </div>
      </div>

      {/* Match Status Message if needed */}
      {matchState.phase === MatchPhase.ROUND_END && (
          <div className="bg-zinc-800 text-center text-xs text-white py-1 uppercase tracking-widest">
              Round Finished - Waiting for Next Round
          </div>
      )}
       {matchState.phase === MatchPhase.MATCH_END && (
          <div className="bg-yellow-600 text-center text-sm font-bold text-black py-2 uppercase tracking-widest animate-pulse">
              MATCH FINISHED
          </div>
      )}
    </div>
  );
};
