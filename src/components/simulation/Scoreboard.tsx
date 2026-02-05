import React from "react";
import { MatchState, MatchPhase } from "@/lib/engine/types";
import { Bomb, BombStatus } from "@/lib/engine/Bomb";
import { Bot } from "@/lib/engine/Bot";
import { ECONOMY } from "@/lib/engine/constants";

interface ScoreboardProps {
  matchState: MatchState;
  bombState: Bomb;
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
  if (bombState.status === BombStatus.PLANTED) timerColor = "text-red-500 animate-pulse";
  else if (roundTimer < 10) timerColor = "text-red-500";
  else if (matchState.phase === MatchPhase.FREEZETIME) timerColor = "text-green-500";

  // Bomb Progress UI
  const renderBombStatus = () => {
      switch (bombState.status) {
          case BombStatus.PLANTING:
              const plantPct = Math.min(100, (bombState.plantProgress / bombState.TICKS_PLANT) * 100);
              return (
                  <div className="flex flex-col items-center w-full px-2">
                       <div className="text-[10px] text-yellow-500 uppercase font-bold animate-pulse">PLANTING</div>
                       <div className="w-full h-1 bg-zinc-800 mt-1">
                           <div className="h-full bg-yellow-500 transition-all duration-100" style={{ width: `${plantPct}%` }} />
                       </div>
                  </div>
              );
          case BombStatus.PLANTED:
              // Timer counts down from TICKS_EXPLOSION
              const explodePct = (bombState.timer / bombState.TICKS_EXPLOSION) * 100;
              return (
                  <div className="flex flex-col items-center w-full px-2">
                      <div className="text-[10px] text-red-500 uppercase font-bold animate-pulse mb-1">BOMB PLANTED</div>
                      <div className="w-full h-1 bg-zinc-800">
                          <div className="h-full bg-red-600 transition-all duration-300" style={{ width: `${explodePct}%` }} />
                      </div>
                      <div className="text-[10px] text-red-500 font-mono mt-0.5">{(bombState.timer / 2).toFixed(1)}s</div>
                  </div>
              );
          case BombStatus.DEFUSING:
              const defuser = bots.find(b => b.id === bombState.defuserId);
              const hasDefuseKit = defuser?.player.inventory?.hasDefuseKit || false;
              const required = hasDefuseKit ? bombState.TICKS_DEFUSE_KIT : bombState.TICKS_DEFUSE_NO_KIT;
              const defusePct = Math.min(100, (bombState.defuseProgress / required) * 100);
              return (
                  <div className="flex flex-col items-center w-full px-2">
                      <div className="text-[10px] text-blue-500 uppercase font-bold animate-pulse">DEFUSING</div>
                      <div className="w-full h-1 bg-zinc-800 mt-1">
                          <div className="h-full bg-blue-500 transition-all duration-100" style={{ width: `${defusePct}%` }} />
                      </div>
                  </div>
              );
          case BombStatus.DETONATED:
               return <div className="text-[10px] text-red-500 uppercase font-bold">DETONATED</div>;
          case BombStatus.DEFUSED:
               return <div className="text-[10px] text-green-500 uppercase font-bold">DEFUSED</div>;
          default:
               // IDLE - Show Round Timer
               return (
                   <>
                        <div className="text-xs text-zinc-500 font-bold uppercase">Round {matchState.round}</div>
                        <div className={`text-2xl font-bold font-mono ${timerColor}`}>
                            {formatTime(matchState.phase === MatchPhase.FREEZETIME ? matchState.phaseTimer : roundTimer)}
                        </div>
                        {matchState.phase === MatchPhase.FREEZETIME && (
                            <div className="text-[10px] text-green-500 uppercase">Buy Phase</div>
                        )}
                   </>
               );
      }
  };

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

        {/* Center: Timer & Round OR Bomb Status */}
        <div className="w-40 bg-black flex flex-col items-center justify-center border-x border-zinc-800 shrink-0 relative overflow-hidden">
             {renderBombStatus()}
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
