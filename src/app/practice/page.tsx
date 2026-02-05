"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { MatchSimulator, SimulationState } from "@/lib/engine/MatchSimulator";
import { MOCK_PLAYERS_EXPANDED } from "@/lib/mock-players-expanded";
import { Player } from "@/types";
import { Tactic, TeamSide } from "@/lib/engine/TacticsManager";
import { MatchPhase } from "@/lib/engine/types";
import { MapVisualizer } from "@/components/simulation/MapVisualizer";
import { RoundResultOverlay } from "@/components/simulation/RoundResultOverlay";
import { CombatLog } from "@/components/practice/CombatLog";
import { DuelStats } from "@/components/practice/DuelStats";
import { RosterSelection } from "@/components/practice/RosterSelection";
import { TacticsSelection } from "@/components/practice/TacticsSelection";
import { Play, Square, RotateCcw, X, Settings } from "lucide-react";

type Step = "ROSTER" | "TACTICS" | "SIMULATION";

export default function PracticePage() {
  // --- State ---
  const [step, setStep] = useState<Step>("ROSTER");

  const [teamT, setTeamT] = useState<Player[]>([]);
  const [teamCT, setTeamCT] = useState<Player[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Record<string, number>>>({});
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const [tacticT, setTacticT] = useState<Tactic>("DEFAULT");
  const [tacticCT, setTacticCT] = useState<Tactic>("DEFAULT");

  // Simulation State
  const [gameState, setGameState] = useState<SimulationState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isTacticsModalOpen, setIsTacticsModalOpen] = useState(false);

  const simulatorRef = useRef<MatchSimulator | null>(null);

  // --- Handlers ---

  const handleReset = useCallback(() => {
    if (simulatorRef.current) {
      simulatorRef.current.reset();
      setIsRunning(false);
      setGameState({
          bots: simulatorRef.current.bots,
          tickCount: simulatorRef.current.tickCount,
          events: simulatorRef.current.events,
          stats: simulatorRef.current.stats,
          matchState: simulatorRef.current.matchState,
          bombState: simulatorRef.current.bomb,
          roundTimer: simulatorRef.current.roundTimer,
          zoneStates: simulatorRef.current.zoneStates
      });
    } else {
        setGameState(null);
    }
  }, []);

  const handleRandomize = useCallback(() => {
    // Pick 10 unique players
    const shuffled = [...MOCK_PLAYERS_EXPANDED].sort(() => Math.random() - 0.5);
    setTeamT(shuffled.slice(0, 5));
    setTeamCT(shuffled.slice(5, 10));
  }, []);

  // --- Initialization ---
  useEffect(() => {
    // Initial randomization on mount if empty
    if (teamT.length === 0) {
        handleRandomize();
    }
  }, [handleRandomize, teamT.length]);

  const handleOverrideUpdate = (playerId: string, stat: string, value: number) => {
    setOverrides(prev => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] || {}),
        [stat]: value
      }
    }));
  };

  const handleStartSimulation = () => {
    // Apply Overrides
    const applyOverrides = (p: Player) => {
      const override = overrides[p.id];
      if (!override) return p;

      // Deep clone
      const clone = JSON.parse(JSON.stringify(p));
      if (override.aggression) clone.skills.mental.aggression = override.aggression;
      if (override.shooting) clone.skills.technical.shooting = override.shooting;
      if (override.reactionTime) clone.skills.physical.reactionTime = override.reactionTime;
      return clone;
    };

    const modTeamT = teamT.map(applyOverrides);
    const modTeamCT = teamCT.map(applyOverrides);

    const combined: Player[] = [];
    for (let i = 0; i < 5; i++) {
        if (modTeamT[i]) combined.push(modTeamT[i]);
        if (modTeamCT[i]) combined.push(modTeamCT[i]);
    }

    const sim = new MatchSimulator(combined, (state) => {
      setGameState({ ...state });
    });

    sim.setSpeed(playbackSpeed);
    simulatorRef.current = sim;

    // Initial State
    setGameState({
        bots: sim.bots,
        tickCount: sim.tickCount,
        events: sim.events,
        stats: sim.stats,
        matchState: sim.matchState,
        bombState: sim.bomb,
        roundTimer: sim.roundTimer,
        zoneStates: sim.zoneStates
    });

    sim.start();
    setIsRunning(true);
    setStep("SIMULATION");
  };

  const handleStop = () => {
    if (simulatorRef.current) {
      simulatorRef.current.stop();
      setIsRunning(false);
    }
  };

  const handleResume = () => {
      if (simulatorRef.current) {
          simulatorRef.current.start();
          setIsRunning(true);
      }
  };

  const handleEndMatch = () => {
      handleStop();
      simulatorRef.current = null;
      setGameState(null);
      setStep("ROSTER");
  };

  const handleNextRound = () => {
      if (simulatorRef.current) {
          simulatorRef.current.nextRound();
      }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (simulatorRef.current) {
        simulatorRef.current.setSpeed(speed);
    }
  };

  // --- Auto-Apply Tactics on Phase Change ---
  useEffect(() => {
      if (!simulatorRef.current || !gameState) return;

      if (gameState.matchState.phase === MatchPhase.PAUSED_FOR_STRATEGY) {
          // Apply current tactic state
          simulatorRef.current.applyStrategies("FULL", tacticT, "FULL", tacticCT);
      }
  }, [gameState?.matchState.phase, tacticT, tacticCT]);


  // --- Render ---

  if (step === "ROSTER") {
      return (
          <div className="h-screen overflow-hidden">
              <RosterSelection
                teamT={teamT}
                teamCT={teamCT}
                overrides={overrides}
                onUpdateOverride={handleOverrideUpdate}
                onRandomize={handleRandomize}
                onNext={() => setStep("TACTICS")}
              />
          </div>
      );
  }

  if (step === "TACTICS") {
      return (
          <div className="h-screen overflow-hidden">
              <TacticsSelection
                tacticT={tacticT}
                tacticCT={tacticCT}
                onTacticChange={(side, t) => side === TeamSide.T ? setTacticT(t) : setTacticCT(t)}
                onStart={handleStartSimulation}
                onBack={() => setStep("ROSTER")}
              />
          </div>
      );
  }

  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden relative">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header / Controls */}
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950">
           <h1 className="text-xl font-bold uppercase tracking-widest text-yellow-500">
             Scrimmage Lab <span className="text-zinc-600 text-sm ml-2 normal-case tracking-normal">v0.9</span>
           </h1>

           <div className="flex items-center space-x-4">
             {/* Speed Controls */}
             <div className="flex bg-zinc-900 rounded border border-zinc-800">
               {[0.5, 1, 2, 5].map(s => (
                 <button
                   key={s}
                   onClick={() => handleSpeedChange(s)}
                   className={`px-3 py-1 text-xs font-bold ${playbackSpeed === s ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                 >
                   {s}x
                 </button>
               ))}
             </div>

             <div className="h-6 w-px bg-zinc-800" />

             <button
                onClick={() => setIsTacticsModalOpen(true)}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded text-xs font-bold uppercase tracking-wider"
             >
                <Settings size={14} /> Tactics
             </button>

             {/* Playback */}
             <div className="flex space-x-2">
               {!isRunning ? (
                 <button onClick={handleResume} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-sm font-bold">
                   <Play size={16} /> Start
                 </button>
               ) : (
                 <button onClick={handleStop} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded text-sm font-bold">
                   <Square size={16} /> Pause
                 </button>
               )}
               <button onClick={handleReset} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded text-sm font-bold">
                 <RotateCcw size={16} /> Reset
               </button>
             </div>

             <div className="h-6 w-px bg-zinc-800" />

             <button onClick={handleEndMatch} className="text-red-500 hover:text-red-400 font-bold text-xs uppercase tracking-widest">
                 End Match
             </button>
           </div>
        </header>

        {/* Workspace Grid - Full Width */}
        <div className="flex-1 grid grid-cols-4 gap-0 min-h-0">
            {/* Map (3 cols) */}
            <div className="col-span-3 bg-zinc-900/50 relative border-r border-zinc-800 flex flex-col min-h-0">
               {/* Overlay Info */}
               <div className="absolute top-4 left-4 z-10 pointer-events-none">
                 <div className="text-zinc-400 text-xs font-mono">
                    Tick: <span className="text-white text-lg">{gameState?.tickCount || 0}</span>
                 </div>
               </div>

               <div className="flex-1 p-8 flex items-center justify-center overflow-hidden">
                  {simulatorRef.current ? (
                      <MapVisualizer
                        map={simulatorRef.current.map}
                        bots={gameState?.bots || []}
                        selectedBotId={selectedPlayerId}
                      />
                  ) : (
                      <div className="text-zinc-600">Initializing...</div>
                  )}
               </div>
            </div>

            {/* Right Panel (Logs & Stats) - 1 col */}
            <div className="col-span-1 flex flex-col min-h-0 bg-zinc-950">
               <div className="h-1/2 border-b border-zinc-800">
                  <CombatLog logs={gameState?.events || []} />
               </div>
               <div className="h-1/2">
                  <DuelStats
                    stats={gameState?.stats || {}}
                    players={[...teamT, ...teamCT]}
                  />
               </div>
            </div>
        </div>
      </div>

      {/* Round Result Overlay */}
      {gameState?.matchState.phase === MatchPhase.ROUND_END && (
          <RoundResultOverlay
              matchState={gameState.matchState}
              bots={gameState.bots}
              stats={gameState.stats}
              onNextRound={handleNextRound}
          />
      )}

      {/* In-Game Tactics Modal */}
      {isTacticsModalOpen && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-zinc-900 border border-zinc-700 w-full max-w-lg shadow-2xl p-6">
                  <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-bold text-white">Update Tactics</h3>
                      <button onClick={() => setIsTacticsModalOpen(false)} className="text-zinc-500 hover:text-white">
                          <X className="w-5 h-5" />
                      </button>
                  </div>

                  <p className="text-sm text-zinc-500 mb-6">Changes will apply at the start of the next round.</p>

                  <div className="space-y-6">
                      <div>
                          <label className="block text-sm font-bold text-yellow-500 mb-2">T Side Strategy</label>
                          <select
                              value={tacticT}
                              onChange={(e) => setTacticT(e.target.value as Tactic)}
                              className="w-full bg-zinc-950 border border-zinc-800 text-white p-3 rounded"
                          >
                                <option value="DEFAULT">Default</option>
                                <option value="RUSH_A">Rush A</option>
                                <option value="RUSH_B">Rush B</option>
                                <option value="EXECUTE_A">Execute A</option>
                                <option value="EXECUTE_B">Execute B</option>
                                <option value="SPLIT_A">Split A</option>
                                <option value="SPLIT_B">Split B</option>
                                <option value="CONTACT_A">Contact A</option>
                                <option value="CONTACT_B">Contact B</option>
                          </select>
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-blue-500 mb-2">CT Side Strategy</label>
                          <select
                              value={tacticCT}
                              onChange={(e) => setTacticCT(e.target.value as Tactic)}
                              className="w-full bg-zinc-950 border border-zinc-800 text-white p-3 rounded"
                          >
                                <option value="STANDARD">Standard (2-1-2)</option>
                                <option value="AGGRESSIVE_PUSH">Aggressive Push</option>
                                <option value="GAMBLE_STACK_A">Stack A</option>
                                <option value="GAMBLE_STACK_B">Stack B</option>
                                <option value="RETAKE_SETUP">Retake Setup</option>
                          </select>
                      </div>
                  </div>

                  <div className="mt-8 flex justify-end">
                      <button
                          onClick={() => setIsTacticsModalOpen(false)}
                          className="px-4 py-2 bg-white text-black font-bold rounded hover:bg-zinc-200"
                      >
                          Close
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
