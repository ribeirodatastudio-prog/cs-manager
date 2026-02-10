import { Bot } from "./Bot";
import { SimulationState } from "./MatchSimulator";

export interface TelemetryBotState {
  id: string;
  side: string;
  pos: { x: number; y: number };
  angle: number; // View angle if available, else 0
  hp: number;
  targetZone: string | null;
  visibleEnemies: string[]; // IDs
  velocity: number; // speed
  action: string; // current action/state
}

export interface TelemetryTick {
  tick: number;
  events: string[];
  bots: TelemetryBotState[];
}

export interface TelemetryRound {
  round: number;
  winner?: string;
  reason?: string;
  ticks: TelemetryTick[];
}

export class TelemetrySystem {
  private currentRound: TelemetryRound | null = null;
  private rounds: TelemetryRound[] = [];

  constructor() {}

  startRound(roundNumber: number) {
    if (this.currentRound) {
        this.rounds.push(this.currentRound);
    }
    this.currentRound = {
      round: roundNumber,
      ticks: []
    };
  }

  endRound(winner: string, reason: string) {
      if (this.currentRound) {
          this.currentRound.winner = winner;
          this.currentRound.reason = reason;
          this.rounds.push(this.currentRound);
          this.currentRound = null;
      }
  }

  logTick(state: SimulationState) {
    if (!this.currentRound) {
        // Auto-start if needed
        this.startRound(state.matchState.round);
    }

    // Check if round changed
    if (this.currentRound!.round !== state.matchState.round) {
        this.endRound("UNKNOWN", "ROUND_CHANGE");
        this.startRound(state.matchState.round);
    }

    const botStates: TelemetryBotState[] = state.bots.map(bot => ({
      id: bot.id,
      side: bot.side,
      pos: { x: Math.round(bot.pos.x), y: Math.round(bot.pos.y) },
      angle: 0, // Not currently tracked in Bot explicit state
      hp: bot.hp,
      targetZone: bot.goalZoneId,
      visibleEnemies: bot.visibleEnemies.map(v => v.id),
      velocity: 0, // Could compute from prevPos
      action: bot.aiState
    }));

    // Filter events to only new ones?
    // State.events accumulates all events. We probably only want recent ones or all?
    // Usually state.events grows indefinitely.
    // Let's just store length or last few.
    // Actually typically telemetry wants events *occurred* this tick.
    // MatchSimulator.events is a list of strings unshift-ed.
    // So state.events[0] is the latest.
    // We can track last event count.

    // For now, let's just log bots. Events are secondary.

    this.currentRound!.ticks.push({
      tick: state.tickCount,
      events: [], // Placeholder
      bots: botStates
    });
  }

  getRoundData(roundIndex: number): TelemetryRound | undefined {
      if (this.currentRound && this.currentRound.round === roundIndex) return this.currentRound;
      return this.rounds.find(r => r.round === roundIndex);
  }

  getLastRoundData(): TelemetryRound | null {
      if (this.currentRound) return this.currentRound;
      if (this.rounds.length > 0) return this.rounds[this.rounds.length - 1];
      return null;
  }

  getAllRounds(): TelemetryRound[] {
      return [...this.rounds, ...(this.currentRound ? [this.currentRound] : [])];
  }
}
