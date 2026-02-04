"use client";

import React, { useEffect, useRef, useState } from "react";
import { MatchSimulator, SimulationState } from "@/lib/engine/MatchSimulator";
import { MOCK_PLAYERS } from "@/lib/mock-players";
import { Player } from "@/types";
import { MapVisualizer } from "@/components/simulation/MapVisualizer";
import { SimulationControls } from "@/components/simulation/SimulationControls";
import { Tactic, TeamSide } from "@/lib/engine/TacticsManager";

// Helper to create 10 players from the mock 5
const generatePlayers = (): Player[] => {
  const players: Player[] = [];
  // Team 1 (Originals)
  MOCK_PLAYERS.forEach(p => players.push({ ...p, id: `${p.id}_1`, name: `${p.name} (1)` }));
  // Team 2 (Clones)
  MOCK_PLAYERS.forEach(p => players.push({ ...p, id: `${p.id}_2`, name: `${p.name} (2)` }));
  return players;
};

export default function SimulationPage() {
  const simulatorRef = useRef<MatchSimulator | null>(null);
  const [gameState, setGameState] = useState<SimulationState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [tTactic, setTTactic] = useState<Tactic>("DEFAULT");
  const [ctTactic, setCtTactic] = useState<Tactic>("DEFAULT");

  useEffect(() => {
    // Initialize Simulator
    const players = generatePlayers();
    const sim = new MatchSimulator(players, (state) => {
      setGameState({ ...state }); // Spread to trigger re-render
    });

    // Set initial state
    setGameState({
      bots: sim.bots,
      tickCount: sim.tickCount,
      events: sim.events
    });

    simulatorRef.current = sim;

    return () => {
      sim.stop();
    };
  }, []);

  // Update Tactics when state changes
  useEffect(() => {
    if (simulatorRef.current) {
      simulatorRef.current.tacticsManager.setTactic("T", tTactic);
    }
  }, [tTactic]);

  useEffect(() => {
    if (simulatorRef.current) {
      simulatorRef.current.tacticsManager.setTactic("CT", ctTactic);
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
        events: simulatorRef.current.events
      });
    }
  };

  const handleTacticChange = (side: TeamSide, tactic: Tactic) => {
    if (side === "T") setTTactic(tactic);
    else setCtTactic(tactic);
  };

  if (!gameState || !simulatorRef.current) {
    return <div className="text-white p-10">Loading Simulation...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold uppercase tracking-widest text-yellow-500 mb-2">
            Counter-Strike Strategy Engine
          </h1>
          <p className="text-zinc-500">
            Phase 1-3 Prototype: Map, Navigation, Combat
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Map Visualization (Left 2 cols) */}
          <div className="lg:col-span-2">
            <MapVisualizer
              map={simulatorRef.current.map}
              bots={gameState.bots}
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
              onTacticChange={handleTacticChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
