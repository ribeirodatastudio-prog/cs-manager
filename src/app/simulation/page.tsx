"use client";

import React, { useEffect, useRef, useState } from "react";
import { MatchSimulator, SimulationState } from "@/lib/engine/MatchSimulator";
import { generateTeam } from "@/lib/player-generator";
import { Player } from "@/types";
import { MapVisualizer } from "@/components/simulation/MapVisualizer";
import { SimulationControls } from "@/components/simulation/SimulationControls";
import { MatchHUD } from "@/components/simulation/MatchHUD";
import { Scoreboard } from "@/components/simulation/Scoreboard";
import { SituationRoom } from "@/components/simulation/SituationRoom";
import { Tactic, TeamSide } from "@/lib/engine/TacticsManager";
import { MatchPhase, BuyStrategy } from "@/lib/engine/types";
import { RoundResultOverlay } from "@/components/simulation/RoundResultOverlay";
import { Users, RefreshCw, CheckCircle } from "lucide-react";

export default function SimulationPage() {
  const simulatorRef = useRef<MatchSimulator | null>(null);

  // App State
  const [simPhase, setSimPhase] = useState<'ROSTER_SELECTION' | 'GAME'>('ROSTER_SELECTION');
  const [players, setPlayers] = useState<Player[]>([]);

  // Simulation State
  const [gameState, setGameState] = useState<SimulationState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [tTactic, setTTactic] = useState<Tactic>("DEFAULT");
  const [ctTactic, setCtTactic] = useState<Tactic>("STANDARD");

  // Initial Roster Generation
  useEffect(() => {
    handleRegenerateRoster();
  }, []);

  const handleRegenerateRoster = () => {
    const newTeam = generateTeam(10, 1);
    setPlayers(newTeam);
  };

  const handleConfirmRoster = () => {
    setSimPhase('GAME');
    initializeSimulation(players);
  };

  const initializeSimulation = (roster: Player[]) => {
    const sim = new MatchSimulator(roster, (state) => {
      setGameState({ ...state });
    });

    // Set initial state immediately
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

    simulatorRef.current = sim;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (simulatorRef.current) {
        simulatorRef.current.stop();
      }
    };
  }, []);

  // Update Tactics when state changes
  useEffect(() => {
    if (simulatorRef.current) {
      simulatorRef.current.tacticsManager.setTactic(TeamSide.T, tTactic);
    }
  }, [tTactic]);

  useEffect(() => {
    if (simulatorRef.current) {
      simulatorRef.current.tacticsManager.setTactic(TeamSide.CT, ctTactic);
    }
  }, [ctTactic]);

  const handleStart = () => {
    if (simulatorRef.current) {
      simulatorRef.current.start();
      setIsRunning(true);
    }
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
      // Update local state immediately
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
    }
  };

  const handleNextRound = () => {
    if (simulatorRef.current) {
      simulatorRef.current.nextRound();
    }
  };

  const handleTacticChange = (side: TeamSide, tactic: Tactic) => {
    if (side === TeamSide.T) setTTactic(tactic);
    else setCtTactic(tactic);
  };

  const handleStrategyConfirm = (tBuy: BuyStrategy, tTactic: Tactic, ctBuy: BuyStrategy, ctTactic: Tactic, roleOverrides: Record<string, string>, buyOverrides: Record<string, BuyStrategy>) => {
    if (simulatorRef.current) {
      simulatorRef.current.applyStrategies(tBuy, tTactic, ctBuy, ctTactic, roleOverrides, buyOverrides);
      setTTactic(tTactic);
      setCtTactic(ctTactic);
    }
  };

  // --- Roster View ---
  if (simPhase === 'ROSTER_SELECTION') {
    const tPlayers = players.filter((_, i) => i % 2 === 0);
    const ctPlayers = players.filter((_, i) => i % 2 !== 0);

    return (
      <div className="min-h-screen bg-zinc-950 text-white p-8 font-sans flex flex-col items-center">
        <div className="max-w-5xl w-full">
          <header className="mb-12 text-center">
            <h1 className="text-4xl font-bold uppercase tracking-widest text-yellow-500 mb-2">
              Match Initialization
            </h1>
            <p className="text-zinc-500">Review and confirm team rosters before starting.</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
            {/* T Side */}
            <div className="bg-zinc-900/50 border border-yellow-900/30 p-6">
              <h2 className="text-2xl font-bold text-yellow-500 mb-6 flex items-center gap-2">
                <Users size={24} /> Terrorists
              </h2>
              <div className="space-y-3">
                {tPlayers.map(p => (
                  <div key={p.id} className="bg-zinc-800 p-3 border-l-2 border-yellow-600 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-white">{p.name}</div>
                      <div className="text-xs text-zinc-500">{p.role} • {p.nationality}</div>
                    </div>
                    <div className="text-right">
                       <div className="text-xs font-mono text-yellow-500">AIM: {Math.floor(p.skills.technical.shooting / 10)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CT Side */}
            <div className="bg-zinc-900/50 border border-blue-900/30 p-6">
              <h2 className="text-2xl font-bold text-blue-500 mb-6 flex items-center gap-2">
                <Users size={24} /> Counter-Terrorists
              </h2>
              <div className="space-y-3">
                {ctPlayers.map(p => (
                  <div key={p.id} className="bg-zinc-800 p-3 border-l-2 border-blue-600 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-white">{p.name}</div>
                      <div className="text-xs text-zinc-500">{p.role} • {p.nationality}</div>
                    </div>
                    <div className="text-right">
                       <div className="text-xs font-mono text-blue-500">AIM: {Math.floor(p.skills.technical.shooting / 10)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-6">
            <button
              onClick={handleRegenerateRoster}
              className="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold uppercase tracking-wider transition-colors border border-zinc-600"
            >
              <RefreshCw size={20} /> Regenerate
            </button>
            <button
              onClick={handleConfirmRoster}
              className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold uppercase tracking-wider transition-colors"
            >
              <CheckCircle size={20} /> Confirm & Start
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Simulation View ---

  if (!gameState || !simulatorRef.current) {
    return <div className="text-white p-10">Initializing Engine...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-widest text-yellow-500 mb-2">
                Counter-Strike Strategy Engine
            </h1>
            <p className="text-zinc-500">
                Phase 4: Economy, Objectives & MR12 Logic
            </p>
          </div>
          <div className="text-zinc-600 text-sm font-mono">
            Roster Locked
          </div>
        </header>

        {gameState.matchState.phase === MatchPhase.PAUSED_FOR_STRATEGY && (
          <SituationRoom
              matchState={gameState.matchState}
              bots={gameState.bots}
              onConfirm={handleStrategyConfirm}
          />
        )}

        {gameState.matchState.phase === MatchPhase.ROUND_END && (
          <RoundResultOverlay
            matchState={gameState.matchState}
            bots={gameState.bots}
            stats={gameState.stats}
            onNextRound={handleNextRound}
          />
        )}

        {/* Scoreboard */}
        <Scoreboard
            matchState={gameState.matchState}
            bombState={gameState.bombState}
            roundTimer={gameState.roundTimer}
            bots={gameState.bots}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Map Visualization (Left 2 cols) */}
          <div className="lg:col-span-2 relative">
            <MatchHUD
              roundTimer={gameState.roundTimer}
              matchState={gameState.matchState}
              bombState={gameState.bombState}
            />
            <MapVisualizer
              map={simulatorRef.current.map}
              bots={gameState.bots}
              zoneStates={gameState.zoneStates}
            />
          </div>

          {/* Controls (Right col) */}
          <div className="lg:col-span-1 h-[600px]">
            <SimulationControls
              isRunning={isRunning}
              tickCount={gameState.tickCount}
              tSideTactic={tTactic}
              ctSideTactic={ctTactic}
              events={gameState.events}
              onStart={handleStart}
              onStop={handleStop}
              onReset={handleReset}
              onNextRound={handleNextRound}
              canStartNextRound={gameState.matchState.phase === MatchPhase.ROUND_END}
              onTacticChange={handleTacticChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
