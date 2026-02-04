import { Bot } from "./Bot";
import { GameMap } from "./GameMap";
import { TacticsManager } from "./TacticsManager";
import { DuelSystem } from "./DuelSystem";
import { Player } from "@/types";
import { DUST2_MAP } from "./maps/dust2";

export interface SimulationState {
  bots: Bot[];
  tickCount: number;
  events: string[]; // Log of events
}

export class MatchSimulator {
  public map: GameMap;
  public tacticsManager: TacticsManager;
  public bots: Bot[];
  public tickCount: number;
  public isRunning: boolean;
  private intervalId: NodeJS.Timeout | null = null;
  private onUpdate: (state: SimulationState) => void;
  public events: string[];

  constructor(players: Player[], onUpdate: (state: SimulationState) => void) {
    this.map = new GameMap(DUST2_MAP);
    this.tacticsManager = new TacticsManager();
    this.tickCount = 0;
    this.isRunning = false;
    this.onUpdate = onUpdate;
    this.events = [];

    // Initialize Bots
    // First 5 T, Next 5 CT? Or based on array?
    // Let's assume MOCK_PLAYERS has roles, but we need to split them.
    // For this demo, let's clone the players to make 5 v 5 if needed,
    // or just assign first half T, second half CT.
    // The user provided 5 mock players. I will duplicate them or just run 2v3.
    // Let's create 5 Ts and 5 CTs by cloning the mock data if needed.
    // Or just use the 5 provided: 3 T, 2 CT.

    this.bots = players.map((p, i) => {
      const side = i % 2 === 0 ? "T" : "CT"; // Alternating for balance
      const spawn = this.map.getSpawnPoint(side);
      return new Bot(p, side, spawn!.id);
    });
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.intervalId = setInterval(() => this.tick(), 500);
  }

  public stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public reset() {
    this.stop();
    this.tickCount = 0;
    this.events = [];
    // Reset bots to spawn
    this.bots.forEach(bot => {
      bot.hp = 100;
      bot.status = "ALIVE";
      const spawn = this.map.getSpawnPoint(bot.side);
      bot.currentZoneId = spawn!.id;
      bot.path = [];
    });
    this.broadcast();
  }

  private tick() {
    this.tickCount++;

    // 1. Bots Decide & Move
    this.bots.forEach(bot => {
      if (bot.status === "DEAD") return;

      const action = bot.decideAction(this.map, this.tacticsManager);

      if (action.type === "MOVE" && action.targetZoneId) {
        // Execute Move
        bot.currentZoneId = action.targetZoneId;
        // Update path (remove the node we just moved to)
        if (bot.path.length > 0 && bot.path[0] === action.targetZoneId) {
          bot.path.shift();
        }
      }
    });

    // 2. Resolve Combat
    this.resolveCombat();

    // 3. Broadcast
    this.broadcast();

    // Check End Condition (Optional for now)
  }

  private resolveCombat() {
    // Group by zone
    const zoneOccupants: Record<string, Bot[]> = {};

    this.bots.forEach(bot => {
      if (bot.status === "DEAD") return;
      if (!zoneOccupants[bot.currentZoneId]) {
        zoneOccupants[bot.currentZoneId] = [];
      }
      zoneOccupants[bot.currentZoneId].push(bot);
    });

    // Check for conflicts
    Object.entries(zoneOccupants).forEach(([zoneId, bots]) => {
      const ts = bots.filter(b => b.side === "T");
      const cts = bots.filter(b => b.side === "CT");

      if (ts.length > 0 && cts.length > 0) {
        const zone = this.map.getZone(zoneId);
        if (!zone) return;

        // Simple All vs All round robin?
        // Or each bot picks a target?
        // Let's have each bot pick a random target from enemy list.

        bots.forEach(attacker => {
          if (attacker.status === "DEAD") return; // Might have died in previous duel this tick?

          const enemies = attacker.side === "T" ? cts : ts;
          const liveEnemies = enemies.filter(e => e.status === "ALIVE");

          if (liveEnemies.length > 0) {
            const target = liveEnemies[Math.floor(Math.random() * liveEnemies.length)];

            // Resolve Duel
            const result = DuelSystem.resolveDuel(attacker, target, zone);

            // Apply Damage
            // Note: In this simple model, both shoot?
            // DuelSystem returns "Winner" and "Loser".
            // If Winner deals damage, does Loser deal damage?
            // Usually a "Duel" implies exchange.
            // My DuelSystem only calculates damage for the WINNER -> Loser.
            // So if I win, I hit you. You miss?
            // That works.

            const loserBot = this.bots.find(b => b.id === result.loserId);
            if (loserBot && loserBot.status === "ALIVE") {
               loserBot.takeDamage(result.damage);
               this.events.unshift(`[${this.tickCount}] ${attacker.player.name} hit ${loserBot.player.name} for ${Math.round(result.damage)} dmg in ${zone.name}`);

               // Check if they died from this damage
               if (loserBot.hp <= 0) {
                 this.events.unshift(`[${this.tickCount}] 💀 ${loserBot.player.name} was eliminated by ${attacker.player.name}!`);
               }
            }
          }
        });
      }
    });
  }

  private broadcast() {
    this.onUpdate({
      bots: this.bots,
      tickCount: this.tickCount,
      events: this.events
    });
  }
}
