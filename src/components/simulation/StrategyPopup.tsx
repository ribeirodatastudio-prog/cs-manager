"use client";

import React, { useState, useEffect } from "react";
import { MatchState, BuyStrategy, MatchPhase } from "@/lib/engine/types";
import { Tactic, TeamSide } from "@/lib/engine/TacticsManager";
import { Bot } from "@/lib/engine/Bot";

interface StrategyPopupProps {
  matchState: MatchState;
  bots: Bot[];
  onConfirm: (tBuy: BuyStrategy, tTactic: Tactic, ctBuy: BuyStrategy, ctTactic: Tactic) => void;
}

export const StrategyPopup: React.FC<StrategyPopupProps> = ({ matchState, bots, onConfirm }) => {
  const [tBuy, setTBuy] = useState<BuyStrategy>("ECO");
  const [tTactic, setTTactic] = useState<Tactic>("DEFAULT");
  const [ctBuy, setCtBuy] = useState<BuyStrategy>("ECO");
  const [ctTactic, setCtTactic] = useState<Tactic>("STANDARD"); // Changed default to STANDARD

  // Reset to ECO/DEFAULT when round changes or phase becomes PAUSED?
  // We can use useEffect to set defaults based on money when popup appears
  useEffect(() => {
      if (matchState.phase === MatchPhase.PAUSED_FOR_STRATEGY) {
          // Heuristic for default selection (Quality of Life)
          const tMoney = bots.filter(b => b.side === TeamSide.T).reduce((acc, b) => acc + (b.player.inventory?.money || 0), 0) / 5;
          if (tMoney >= 4000) setTBuy("FULL");
          else if (tMoney >= 2000) setTBuy("FORCE");
          else setTBuy("ECO");

          const ctMoney = bots.filter(b => b.side === TeamSide.CT).reduce((acc, b) => acc + (b.player.inventory?.money || 0), 0) / 5;
          if (ctMoney >= 4000) setCtBuy("FULL");
          else if (ctMoney >= 2000) setCtBuy("FORCE");
          else setCtBuy("ECO");
      }
  }, [matchState.phase, bots]);


  if (matchState.phase !== MatchPhase.PAUSED_FOR_STRATEGY) return null;

  // Calculate Team Money
  const tTotal = bots.filter(b => b.side === TeamSide.T).reduce((acc, b) => acc + (b.player.inventory?.money || 0), 0);
  const ctTotal = bots.filter(b => b.side === TeamSide.CT).reduce((acc, b) => acc + (b.player.inventory?.money || 0), 0);

  return (
     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="bg-zinc-900 border border-zinc-700 p-6 w-[800px] shadow-2xl relative">
             <h2 className="text-2xl font-bold text-yellow-500 mb-6 uppercase tracking-wider text-center">Tactical Phase</h2>

             <div className="grid grid-cols-2 gap-8">
                {/* T Side */}
                <div className="bg-zinc-800/50 p-4 border border-yellow-900/30">
                    <h3 className="text-xl font-bold text-yellow-400 mb-2">Terrorists</h3>
                    <div className="flex justify-between text-sm text-zinc-400 mb-4">
                        <span>Total Money: <span className="text-green-400">${tTotal.toLocaleString()}</span></span>
                        <span>Loss Bonus: {matchState.lossBonus.T}</span>
                    </div>

                    <div className="mb-4">
                        <label className="block text-xs uppercase text-zinc-500 mb-1">Buy Strategy</label>
                        <select
                            value={tBuy}
                            onChange={(e) => setTBuy(e.target.value as BuyStrategy)}
                            className="w-full bg-zinc-950 border border-zinc-700 p-2 text-white focus:border-yellow-500 outline-none"
                        >
                            <option value="ECO">Eco</option>
                            <option value="FORCE">Force Buy</option>
                            <option value="HALF">Half Buy</option>
                            <option value="BONUS">Bonus</option>
                            <option value="FULL">Full Buy</option>
                            <option value="HERO">Hero Buy</option>
                        </select>
                    </div>

                    <div className="mb-4">
                        <label className="block text-xs uppercase text-zinc-500 mb-1">Tactic</label>
                        <select
                            value={tTactic}
                            onChange={(e) => setTTactic(e.target.value as Tactic)}
                            className="w-full bg-zinc-950 border border-zinc-700 p-2 text-white focus:border-yellow-500 outline-none"
                        >
                            <option value="DEFAULT">Default</option>
                            <option value="RUSH_A">Rush A</option>
                            <option value="RUSH_B">Rush B</option>
                            <option value="EXECUTE_A">Execute A</option>
                            <option value="EXECUTE_B">Execute B</option>
                            <option value="CONTACT_A">Contact A</option>
                            <option value="CONTACT_B">Contact B</option>
                            <option value="SPLIT_A">Split A</option>
                            <option value="SPLIT_B">Split B</option>
                        </select>
                    </div>
                </div>

                {/* CT Side */}
                <div className="bg-zinc-800/50 p-4 border border-blue-900/30">
                    <h3 className="text-xl font-bold text-blue-400 mb-2">Counter-Terrorists</h3>
                    <div className="flex justify-between text-sm text-zinc-400 mb-4">
                        <span>Total Money: <span className="text-green-400">${ctTotal.toLocaleString()}</span></span>
                        <span>Loss Bonus: {matchState.lossBonus.CT}</span>
                    </div>

                    <div className="mb-4">
                        <label className="block text-xs uppercase text-zinc-500 mb-1">Buy Strategy</label>
                        <select
                            value={ctBuy}
                            onChange={(e) => setCtBuy(e.target.value as BuyStrategy)}
                            className="w-full bg-zinc-950 border border-zinc-700 p-2 text-white focus:border-blue-500 outline-none"
                        >
                             <option value="ECO">Eco</option>
                            <option value="FORCE">Force Buy</option>
                            <option value="HALF">Half Buy</option>
                            <option value="BONUS">Bonus</option>
                            <option value="FULL">Full Buy</option>
                            <option value="HERO">Hero Buy</option>
                        </select>
                    </div>

                    <div className="mb-4">
                        <label className="block text-xs uppercase text-zinc-500 mb-1">Tactic</label>
                        <select
                            value={ctTactic}
                            onChange={(e) => setCtTactic(e.target.value as Tactic)}
                            className="w-full bg-zinc-950 border border-zinc-700 p-2 text-white focus:border-blue-500 outline-none"
                        >
                            <option value="STANDARD">Standard</option>
                            <option value="AGGRESSIVE_PUSH">Aggressive Push</option>
                            <option value="GAMBLE_STACK_A">Gamble Stack A</option>
                            <option value="GAMBLE_STACK_B">Gamble Stack B</option>
                            <option value="RETAKE_SETUP">Retake Setup</option>
                        </select>
                    </div>
                </div>
             </div>

             <div className="mt-8 flex justify-center">
                 <button
                    onClick={() => onConfirm(tBuy, tTactic, ctBuy, ctTactic)}
                    className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 uppercase tracking-widest transition-colors cursor-pointer"
                 >
                    Confirm Strategy
                 </button>
             </div>
        </div>
     </div>
  );
};
