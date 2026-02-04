"use client";

import React, { useEffect, useRef, useState } from "react";
import { MatchSimulator, SimulationState } from "@/lib/engine/MatchSimulator";
import { MOCK_PLAYERS_EXPANDED } from "@/lib/mock-players-expanded";
import { Player } from "@/types";
import { Tactic } from "@/lib/engine/TacticsManager";
import { MapVisualizer } from "@/components/simulation/MapVisualizer";
import { PracticeSidebar } from "@/components/practice/PracticeSidebar";
import { CombatLog } from "@/components/practice/CombatLog";
import { DuelStats } from "@/components/practice/DuelStats";
import { Play, Square, RotateCcw, FastForward } from "lucide-react";

export default function PracticePage() {
  // --- State ---
  const [teamT, setTeamT] = useState<Player[]>([]);
  const [teamCT, setTeamCT] = useState<Player[]>([]);
  const [overrides, setOverrides] = useState<Record<string, any>>({});
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const [tacticT, setTacticT] = useState<Tactic>("DEFAULT");
  const [tacticCT, setTacticCT] = useState<Tactic>("DEFAULT");

  const [gameState, setGameState] = useState<SimulationState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const simulatorRef = useRef<MatchSimulator | null>(null);

  // --- Initialization ---
  useEffect(() => {
    handleRandomize();
  }, []);

  // --- Handlers ---

  const handleRandomize = () => {
    // Pick 10 unique players
    const shuffled = [...MOCK_PLAYERS_EXPANDED].sort(() => Math.random() - 0.5);
    setTeamT(shuffled.slice(0, 5));
    setTeamCT(shuffled.slice(5, 10));
    handleReset(); // Reset sim if teams change
  };

  const handleOverrideUpdate = (playerId: string, stat: string, value: number) => {
    setOverrides(prev => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] || {}),
        [stat]: value
      }
    }));
  };

  const handleStart = () => {
    if (simulatorRef.current && !isRunning) {
        simulatorRef.current.start();
        setIsRunning(true);
        return;
    }

    // New Start (or Restart if stopped)
    // Apply Overrides
    const applyOverrides = (p: Player) => {
      const override = overrides[p.id];
      if (!override) return p;

      // Deep clone to avoid mutating state directly/permanently
      const clone = JSON.parse(JSON.stringify(p));
      if (override.aggression) clone.skills.mental.aggression = override.aggression;
      if (override.shooting) clone.skills.technical.shooting = override.shooting;
      if (override.reactionTime) clone.skills.physical.reactionTime = override.reactionTime;
      // Add more as needed
      return clone;
    };

    const modTeamT = teamT.map(applyOverrides);
    const modTeamCT = teamCT.map(applyOverrides);

    // Combine (interleaved for MatchSimulator constructor logic, though we should fix that logic eventually)
    // MatchSimulator alternates T/CT. So we need to weave them: T1, CT1, T2, CT2...
    const combined: Player[] = [];
    for (let i = 0; i < 5; i++) {
        if (modTeamT[i]) combined.push(modTeamT[i]);
        if (modTeamCT[i]) combined.push(modTeamCT[i]);
    }

    const sim = new MatchSimulator(combined, (state) => {
      setGameState({ ...state });
    });

    // Set initial tactics
    sim.tacticsManager.setTactic("T", tacticT);
    sim.tacticsManager.setTactic("CT", tacticCT);
    sim.setSpeed(playbackSpeed);

    simulatorRef.current = sim;

    // Initial State
    setGameState({
        bots: sim.bots,
        tickCount: sim.tickCount,
        events: sim.events,
        stats: sim.stats
    });

    sim.start();
    setIsRunning(true);
  };

  const handleStop = () => {
    if (simulatorRef.current) {
      simulatorRef.current.stop();
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    if (simulatorRef.current) {
      simulatorRef.current.reset();
      setIsRunning(false);
      setGameState({
          bots: simulatorRef.current.bots,
          tickCount: simulatorRef.current.tickCount,
          events: simulatorRef.current.events,
          stats: simulatorRef.current.stats
      });
    } else {
        setGameState(null);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (simulatorRef.current) {
        simulatorRef.current.setSpeed(speed);
    }
  };

  // Update Tactics on fly
  useEffect(() => {
    if (simulatorRef.current) {
        simulatorRef.current.tacticsManager.setTactic("T", tacticT);
    }
  }, [tacticT]);

  useEffect(() => {
    if (simulatorRef.current) {
        simulatorRef.current.tacticsManager.setTactic("CT", tacticCT);
    }
  }, [tacticCT]);


  return (
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <PracticeSidebar
        teamT={teamT}
        teamCT={teamCT}
        selectedPlayerId={selectedPlayerId}
        onSelectPlayer={setSelectedPlayerId}
        overrides={overrides}
        onUpdateOverride={handleOverrideUpdate}
        tacticT={tacticT}
        tacticCT={tacticCT}
        onTacticChange={(side, t) => side === "T" ? setTacticT(t) : setTacticCT(t)}
        onRandomize={handleRandomize}
      />

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

             {/* Playback */}
             <div className="flex space-x-2">
               {!isRunning ? (
                 <button onClick={handleStart} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-sm font-bold">
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
           </div>
        </header>

        {/* Workspace Grid */}
        <div className="flex-1 grid grid-cols-3 gap-0 min-h-0">
            {/* Map (2 cols) */}
            <div className="col-span-2 bg-zinc-900/50 relative border-r border-zinc-800 flex flex-col">
               {/* Overlay Info */}
               <div className="absolute top-4 left-4 z-10 pointer-events-none">
                 <div className="text-zinc-400 text-xs font-mono">
                    Tick: <span className="text-white text-lg">{gameState?.tickCount || 0}</span>
                 </div>
               </div>

               <div className="flex-1 p-8 flex items-center justify-center">
                  {simulatorRef.current ? (
                      <MapVisualizer
                        map={simulatorRef.current.map}
                        bots={gameState?.bots || []}
                        selectedBotId={selectedPlayerId}
                      />
                  ) : (
                      <div className="text-zinc-600">Press Start to Initialize Simulation</div>
                  )}
               </div>
            </div>

            {/* Right Panel (Logs & Stats) */}
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
    </div>
  );
}
