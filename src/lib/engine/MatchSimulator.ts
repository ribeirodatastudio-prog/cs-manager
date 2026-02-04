import { Bot } from "./Bot";
import { GameMap } from "./GameMap";
import { TacticsManager } from "./TacticsManager";
import { DuelEngine, DuelResult } from "./DuelEngine";
import { Player } from "@/types";
import { DUST2_MAP } from "./maps/dust2";

export interface PlayerStats {
  kills: number;
  deaths: number;
  damageDealt: number;
  expectedKills: number; // Sum of win probabilities
  actualKills: number; // Matches kills, but good for explicit comparison
}

export interface SimulationState {
  bots: Bot[];
  tickCount: number;
  events: string[]; // Log of events
  stats: Record<string, PlayerStats>;
}

export class MatchSimulator {
  public map: GameMap;
  public tacticsManager: TacticsManager;
  public bots: Bot[];
  public tickCount: number;
  public isRunning: boolean;
  private timeoutId: NodeJS.Timeout | null = null;
  private onUpdate: (state: SimulationState) => void;
  public events: string[];
  public stats: Record<string, PlayerStats> = {};

  // Speed control
  private speedMultiplier: number = 1.0;
  private baseTickRate: number = 500; // ms

  constructor(players: Player[], onUpdate: (state: SimulationState) => void) {
    this.map = new GameMap(DUST2_MAP);
    this.tacticsManager = new TacticsManager();
    this.tickCount = 0;
    this.isRunning = false;
    this.onUpdate = onUpdate;
    this.events = [];

    // Initialize Bots
    // We alternate sides for the provided list.
    this.bots = players.map((p, i) => {
      const side = i % 2 === 0 ? "T" : "CT";
      const spawn = this.map.getSpawnPoint(side);
      return new Bot(p, side, spawn!.id);
    });

    // Init Stats
    this.bots.forEach(b => {
      this.stats[b.player.id] = { kills: 0, deaths: 0, damageDealt: 0, expectedKills: 0, actualKills: 0 };
    });
  }

  public setSpeed(multiplier: number) {
    this.speedMultiplier = multiplier;
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleTick();
  }

  public stop() {
    this.isRunning = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  public reset() {
    this.stop();
    this.tickCount = 0;
    this.events = [];
    this.bots.forEach(bot => {
      bot.hp = 100;
      bot.status = "ALIVE";
      const spawn = this.map.getSpawnPoint(bot.side);
      bot.currentZoneId = spawn!.id;
      bot.path = [];
      // Reset stats
      this.stats[bot.player.id] = { kills: 0, deaths: 0, damageDealt: 0, expectedKills: 0, actualKills: 0 };
    });
    this.broadcast();
  }

  private scheduleTick() {
    if (!this.isRunning) return;
    const delay = this.baseTickRate / this.speedMultiplier;
    this.timeoutId = setTimeout(() => {
        this.tick();
        this.scheduleTick();
    }, delay);
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

    // Track who fought this tick to prevent multi-duels
    const foughtThisTick = new Set<string>();

    // Check for conflicts
    Object.entries(zoneOccupants).forEach(([zoneId, bots]) => {
      const ts = bots.filter(b => b.side === "T");
      const cts = bots.filter(b => b.side === "CT");

      if (ts.length > 0 && cts.length > 0) {
        const zone = this.map.getZone(zoneId);
        if (!zone) return;

        // Shuffle Ts to randomise who initiates
        const shuffledTs = ts.sort(() => Math.random() - 0.5);

        shuffledTs.forEach(attacker => {
          if (attacker.status === "DEAD") return;
          if (foughtThisTick.has(attacker.id)) return;

          // Find a live CT target who hasn't fought ideally?
          // Or can multiple people shoot one guy? Yes.
          const liveCTs = cts.filter(c => c.status === "ALIVE");
          if (liveCTs.length === 0) return;

          const target = liveCTs[Math.floor(Math.random() * liveCTs.length)];

          // Mark both as busy?
          // If we mark target as busy, they can't be shot by another? No, they can be team-shot.
          // But they shouldn't initiate another duel themselves if they are defending.
          // Let's mark attacker as fought.
          foughtThisTick.add(attacker.id);
          // Don't necessarily mark target, they might have to fend off multiple?
          // But `DuelEngine` is 1v1.
          // If 2 Ts shoot 1 CT.
          // Duel 1: T1 vs CT. CT wins.
          // Duel 2: T2 vs CT. T2 wins.
          // This seems fair.

          // Calculate Expected Win Probability (Monte Carlo)
          // We do this BEFORE the actual duel to capture the "pre-fight" odds
          const probs = DuelEngine.getWinProbability(attacker, target, 50);
          this.stats[attacker.id].expectedKills += probs.initiatorWinRate;
          this.stats[target.id].expectedKills += probs.targetWinRate;

          // Resolve Duel
          const result = DuelEngine.calculateOutcome(attacker, target);

          const winner = this.bots.find(b => b.id === result.winnerId);
          const loser = this.bots.find(b => b.id === result.loserId);

          if (winner && loser && loser.status === "ALIVE") {
               loser.takeDamage(result.damage);
               this.stats[winner.id].damageDealt += result.damage;

               // Log
               // We only log the summary to avoid spam, or key details?
               // Requirement: "Live Combat Log that prints the math... Example Log provided".
               // The Example: "[Tick 42] ZywOo... CP: 196 vs Apex... Offset: -26. Wins."
               // DuelEngine returns `result.log` which contains all this.
               // We should extract the LAST few lines or formatting it.
               // `DuelEngine` logs are arrays of strings. I'll join them.

               // But the array might be huge (50 lines). The user wants "The math".
               // Maybe I'll just take the top-level summary or collapse it?
               // The prompt example implies a concise summary line.
               // "ZywOo CP: 196 vs Apex Pos: 170. Offset: -26."
               // `DuelEngine` logs: "Difficulty: 74...", "Tap Check: Score...", "Spray Hit..."
               // I'll format a custom message using the result data AND maybe the first log line about Difficulty.

               // Let's create a collapsible detail or just a rich string.
               // I'll stick to joining the log for now, the UI can display it in a scroll box.

               this.events.unshift(`[Tick ${this.tickCount}] ⚔️ ${attacker.player.name} engaged ${target.player.name} in ${zone.name}.`);

               // Add technical details from log
               // Filter for interesting lines?
               const mathLogs = result.log.filter(l => l.includes("Difficulty") || l.includes("Score") || l.includes("Hit"));
               this.events.unshift(`   > ${mathLogs.join(" | ")}`);

               // Check if they died from this damage
               if (loser.hp <= 0) {
                 this.events.unshift(`[Tick ${this.tickCount}] 💀 ${loser.player.name} was eliminated by ${winner.player.name} (HP Rem: ${winner.hp})`);
                 this.stats[winner.id].kills++;
                 this.stats[winner.id].actualKills++;
                 this.stats[loser.id].deaths++;
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
      events: this.events,
      stats: this.stats
    });
  }
}
