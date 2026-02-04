import { Bot } from "./Bot";
import { GameMap } from "./GameMap";
import { TacticsManager, TeamSide } from "./TacticsManager";
import { DuelEngine, DuelResult } from "./DuelEngine";
import { Player } from "@/types";
import { DUST2_MAP } from "./maps/dust2";
import { MatchState, MatchPhase, RoundEndReason, RoundHistory } from "./types";
import { EconomySystem } from "./EconomySystem";
import { BuyLogic } from "./BuyLogic";
import { ECONOMY } from "./constants";

export interface PlayerStats {
  kills: number;
  deaths: number;
  damageDealt: number;
  assists: number;
  expectedKills: number;
  actualKills: number;
}

export interface BombState {
  isPlanted: boolean;
  plantTick: number; // Tick when it was planted
  plantSite?: string; // Zone ID
  carrierId?: string; // Bot ID
  droppedLocation?: string; // Zone ID
  planterId?: string; // Bot ID for bonus
}

export interface SimulationState {
  bots: Bot[];
  tickCount: number;
  events: string[];
  stats: Record<string, PlayerStats>;
  matchState: MatchState;
  bombState: BombState;
  roundTimer: number; // Seconds
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

  // Match Logic
  public matchState: MatchState;
  public bombState: BombState;
  public roundTimer: number;

  // Config
  private speedMultiplier: number = 1.0;
  private baseTickRate: number = 500; // ms
  private readonly TICKS_PER_SEC = 2;
  private readonly ROUND_TIME = 115; // 1:55
  private readonly BOMB_TIME = 40;
  private readonly FREEZE_TIME = 20;

  constructor(players: Player[], onUpdate: (state: SimulationState) => void) {
    this.map = new GameMap(DUST2_MAP);
    this.tacticsManager = new TacticsManager();
    this.tickCount = 0;
    this.isRunning = false;
    this.onUpdate = onUpdate;
    this.events = [];

    // Initialize Match State
    this.matchState = {
      round: 1,
      scores: { T: 0, CT: 0 },
      phase: MatchPhase.WARMUP,
      phaseTimer: 0,
      lossBonus: { T: 0, CT: 0 },
      roundHistory: [],
      winThreshold: 13
    };

    this.bombState = {
      isPlanted: false,
      plantTick: 0
    };

    this.roundTimer = this.ROUND_TIME;

    // Initialize Bots
    this.bots = players.map((p, i) => {
      const side = i % 2 === 0 ? "T" : "CT";
      const spawn = this.map.getSpawnPoint(side);
      return new Bot(p, side, spawn!.id);
    });

    // Init Stats
    this.bots.forEach(b => {
      this.stats[b.player.id] = { kills: 0, deaths: 0, damageDealt: 0, assists: 0, expectedKills: 0, actualKills: 0 };
    });

    // Start in Freeze Time
    this.startRound(true);
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

  // Next Round Button Action
  public nextRound() {
    if (this.matchState.phase === MatchPhase.ROUND_END) {
        this.startRound();
        this.broadcast();
    }
  }

  public reset() {
    this.stop();
    this.tickCount = 0;
    this.events = [];

    // Reset Stats
    this.bots.forEach(b => {
      this.stats[b.player.id] = { kills: 0, deaths: 0, damageDealt: 0, assists: 0, expectedKills: 0, actualKills: 0 };
    });

    // Reset Match State
    this.matchState = {
      round: 1,
      scores: { T: 0, CT: 0 },
      phase: MatchPhase.WARMUP,
      phaseTimer: 0,
      lossBonus: { T: 0, CT: 0 },
      roundHistory: [],
      winThreshold: 13
    };

    // Reset Economy
    this.bots.forEach(b => {
        if (b.player.inventory) {
            b.player.inventory.money = ECONOMY.START_MONEY;
            b.player.inventory.hasKevlar = false;
            b.player.inventory.hasHelmet = false;
            b.player.inventory.hasKit = false;
            b.player.inventory.utilities = [];
            b.player.inventory.primaryWeapon = undefined;
            b.player.inventory.secondaryWeapon = undefined;
        }
    });

    this.startRound(true);
    this.broadcast();
  }

  private startRound(isMatchStart: boolean = false) {
    // Reset Map Objects
    this.bombState = { isPlanted: false, plantTick: 0 };
    this.roundTimer = this.ROUND_TIME;
    this.matchState.phase = MatchPhase.FREEZETIME;
    this.matchState.phaseTimer = this.FREEZE_TIME;

    // Respawn Bots
    this.bots.forEach(bot => {
      bot.hp = 100;
      bot.status = "ALIVE";
      bot.isPlanting = false;
      bot.isDefusing = false;
      bot.hasBomb = false;
      bot.path = [];
      const spawn = this.map.getSpawnPoint(bot.side);
      bot.currentZoneId = spawn!.id;
    });

    // Assign Bomb to random T
    const ts = this.bots.filter(b => b.side === "T");
    if (ts.length > 0) {
        const carrier = ts[Math.floor(Math.random() * ts.length)];
        carrier.hasBomb = true;
        this.bombState.carrierId = carrier.id;
        this.events.unshift(`[Round ${this.matchState.round}] 💣 ${carrier.player.name} has the bomb.`);
    }

    // Execute Buy Logic
    this.bots.forEach(bot => {
        if (bot.player.inventory) {
            BuyLogic.processBuy(bot.player.inventory, bot.side, bot.player.role);
        }
    });
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

    if (this.matchState.phase === MatchPhase.FREEZETIME) {
        this.tickFreezetime();
    } else if (this.matchState.phase === MatchPhase.LIVE) {
        this.tickLive();
    }
    this.broadcast();
  }

  private tickFreezetime() {
    if (this.tickCount % this.TICKS_PER_SEC === 0) {
        this.matchState.phaseTimer--;
        if (this.matchState.phaseTimer <= 0) {
            this.matchState.phase = MatchPhase.LIVE;
            this.events.unshift("📢 Round Started! GO GO GO!");
        }
    }
  }

  private tickLive() {
    if (this.tickCount % this.TICKS_PER_SEC === 0) {
        if (this.bombState.isPlanted) {
             this.roundTimer--;
        } else {
             this.roundTimer--;
        }
    }

    this.bots.forEach(bot => {
      if (bot.status === "DEAD") return;
      const action = bot.decideAction(this.map, this.tacticsManager);

      if (action.type === "MOVE" && action.targetZoneId) {
        bot.currentZoneId = action.targetZoneId;
        if (bot.path.length > 0 && bot.path[0] === action.targetZoneId) {
          bot.path.shift();
        }
      } else if (action.type === "PLANT") {
          this.handlePlanting(bot);
      } else if (action.type === "DEFUSE") {
          this.handleDefusing(bot);
      }
    });

    this.resolveCombat();
    this.checkWinConditions();
  }

  private handlePlanting(bot: Bot) {
    if (!bot.hasBomb) { bot.isPlanting = false; return; }
    const sites = this.map.data.bombSites;
    if (bot.currentZoneId !== sites.A && bot.currentZoneId !== sites.B) {
        bot.isPlanting = false;
        return;
    }

    bot.isPlanting = true;
    if (!this.bombState.isPlanted) {
        this.bombState.isPlanted = true;
        this.bombState.plantTick = this.tickCount;
        this.bombState.plantSite = bot.currentZoneId;
        this.bombState.planterId = bot.id;
        this.roundTimer = this.BOMB_TIME;
        bot.hasBomb = false;
        bot.isPlanting = false;
        this.events.unshift(`[Tick ${this.tickCount}] 💣 BOMB PLANTED at ${bot.currentZoneId === sites.A ? "A" : "B"} by ${bot.player.name}!`);
        this.events.unshift(`⏱️ 40 seconds to explosion!`);
    }
  }

  private handleDefusing(bot: Bot) {
      if (!this.bombState.isPlanted) { bot.isDefusing = false; return; }
      if (bot.currentZoneId !== this.bombState.plantSite) { bot.isDefusing = false; return; }

      bot.isDefusing = true;
      const requiredTime = DuelEngine.getDefuseTime(bot);
      const requiredTicks = requiredTime / this.baseTickRate;

      if (!this.defuseProgress.has(bot.id)) {
          this.defuseProgress.set(bot.id, 0);
      }

      const progress = this.defuseProgress.get(bot.id)! + 1;
      this.defuseProgress.set(bot.id, progress);

      if (progress >= requiredTicks) {
          this.endRound(TeamSide.CT, RoundEndReason.BOMB_DEFUSED);
      }
  }

  private defuseProgress: Map<string, number> = new Map();

  private resolveCombat() {
    const zoneOccupants: Record<string, Bot[]> = {};
    this.bots.forEach(bot => {
      if (bot.status === "DEAD") return;
      if (!zoneOccupants[bot.currentZoneId]) zoneOccupants[bot.currentZoneId] = [];
      zoneOccupants[bot.currentZoneId].push(bot);
    });

    const foughtThisTick = new Set<string>();

    Object.entries(zoneOccupants).forEach(([zoneId, bots]) => {
      const ts = bots.filter(b => b.side === "T");
      const cts = bots.filter(b => b.side === "CT");

      if (ts.length > 0 && cts.length > 0) {
        const zone = this.map.getZone(zoneId);
        const allBots = [...ts, ...cts].sort(() => Math.random() - 0.5);

        allBots.forEach(attacker => {
           if (attacker.status === "DEAD") return;
           if (foughtThisTick.has(attacker.id)) return;

           if (attacker.isPlanting || attacker.isDefusing) return;

           const targets = allBots.filter(b => b.side !== attacker.side && b.status === "ALIVE");
           if (targets.length === 0) return;

           const target = targets[Math.floor(Math.random() * targets.length)];

           foughtThisTick.add(attacker.id);

           if (target.isPlanting) target.isPlanting = false;
           if (target.isDefusing) {
               target.isDefusing = false;
               this.defuseProgress.delete(target.id);
           }

           const probs = DuelEngine.getWinProbability(attacker, target, 20);
           this.stats[attacker.id].expectedKills += probs.initiatorWinRate;

           const result = DuelEngine.calculateOutcome(attacker, target);
           const winner = result.winnerId === attacker.id ? attacker : target;
           const loser = result.winnerId === attacker.id ? target : attacker;

           loser.takeDamage(result.damage);
           this.stats[winner.id].damageDealt += result.damage;

           this.events.unshift(`[Tick ${this.tickCount}] ⚔️ ${attacker.player.name} vs ${target.player.name} in ${zone?.name}`);

           if (loser.hp <= 0) {
               this.events.unshift(`💀 ${loser.player.name} eliminated by ${winner.player.name}`);
               this.stats[winner.id].kills++;
               this.stats[winner.id].actualKills++;
               this.stats[loser.id].deaths++;

               if (loser.hasBomb) {
                   loser.hasBomb = false;
                   this.bombState.carrierId = undefined;
                   this.bombState.droppedLocation = loser.currentZoneId;
                   this.events.unshift(`⚠️ Bomb dropped at ${zone?.name}!`);
               }
           }
        });
      }
    });
  }

  private checkWinConditions() {
      if (this.bombState.isPlanted && this.roundTimer <= 0) {
          this.endRound(TeamSide.T, RoundEndReason.TARGET_BOMBED);
          return;
      }
      if (!this.bombState.isPlanted && this.roundTimer <= 0) {
          this.endRound(TeamSide.CT, RoundEndReason.TIME_RUNNING_OUT);
          return;
      }

      const tAlive = this.bots.filter(b => b.side === "T" && b.status === "ALIVE").length;
      const ctAlive = this.bots.filter(b => b.side === "CT" && b.status === "ALIVE").length;

      if (tAlive === 0 && !this.bombState.isPlanted) {
          this.endRound(TeamSide.CT, RoundEndReason.ELIMINATION_T);
      }
      if (ctAlive === 0) {
          this.endRound(TeamSide.T, RoundEndReason.ELIMINATION_CT);
      }
  }

  private endRound(winner: TeamSide, reason: RoundEndReason) {
      this.stop();
      this.matchState.phase = MatchPhase.ROUND_END;
      this.matchState.scores[winner]++;

      this.matchState.roundHistory.push({
          roundNumber: this.matchState.round,
          winner,
          reason,
          endTick: this.tickCount
      });

      this.events.unshift(`🏆 ROUND ${this.matchState.round} WON BY ${winner} (${reason})`);
      this.updateEconomy(winner, reason);

      // 1. Check for Match Win (Scores >= Threshold)
      if (this.matchState.scores[winner] === this.matchState.winThreshold) {
          this.matchState.phase = MatchPhase.MATCH_END;
          this.events.unshift(`🎉 MATCH FINISHED! ${winner} WINS!`);
          return;
      }

      const currentRound = this.matchState.round;
      const isRegulationEnd = currentRound === 24;
      const isOtSegmentEnd = currentRound > 24 && (currentRound % 6 === 0);

      // 2. Check for Overtime Trigger (Tie at Regulation End or OT End)
      if (isRegulationEnd || isOtSegmentEnd) {
          if (this.matchState.scores.T === this.matchState.scores.CT) {
              this.handleOvertimeStart();
              // Don't increment round here? Next round is R25.
              // We just handle transition updates (money/threshold).
          }
      }

      // 3. Check for Halftime (Regulation or OT)
      const isRegHalftime = currentRound === 12;
      const isOtHalftime = currentRound > 24 && ((currentRound - 24) % 6 === 3);

      if (isRegHalftime || isOtHalftime) {
          this.handleHalftime();
      }

      this.matchState.round++;
  }

  private updateEconomy(winner: TeamSide, reason: RoundEndReason) {
      this.matchState.lossBonus[winner] = EconomySystem.updateLossBonus(this.matchState.lossBonus[winner], true);
      const loser = winner === "T" ? "CT" : "T";
      this.matchState.lossBonus[loser] = EconomySystem.updateLossBonus(this.matchState.lossBonus[loser], false);

      if (this.matchState.round === 1 || this.matchState.round === 13) {
          if (winner === "T") this.matchState.lossBonus.CT = EconomySystem.getPistolRoundLossLevel();
          else this.matchState.lossBonus.T = EconomySystem.getPistolRoundLossLevel();
      }

      this.bots.forEach(bot => {
          if (!bot.player.inventory) return;
          let income = EconomySystem.calculateIncome(
              bot.side,
              winner,
              reason,
              this.matchState.lossBonus[bot.side],
              this.bombState.isPlanted
          );
          if (bot.side === "T" && bot.status === "ALIVE" && reason === RoundEndReason.TIME_RUNNING_OUT) {
              income = 0;
          }
          bot.player.inventory.money = Math.min(ECONOMY.MAX_MONEY, bot.player.inventory.money + income);
      });
  }

  private handleHalftime() {
      this.events.unshift("🔄 HALFTIME - SWITCHING SIDES");
      const isOvertime = this.matchState.round > 24;
      const startMoney = isOvertime ? ECONOMY.OT_MR12_MONEY : ECONOMY.START_MONEY;

      this.bots.forEach(bot => {
          bot.side = bot.side === "T" ? "CT" : "T";
          if (bot.player.inventory) {
              bot.player.inventory.money = startMoney;
              bot.player.inventory.hasKevlar = false;
              bot.player.inventory.hasHelmet = false;
              bot.player.inventory.hasKit = false;
              bot.player.inventory.utilities = [];
              bot.player.inventory.primaryWeapon = undefined;
              bot.player.inventory.secondaryWeapon = undefined;
          }
      });

      const tempT = this.matchState.scores.T;
      this.matchState.scores.T = this.matchState.scores.CT;
      this.matchState.scores.CT = tempT;

      this.matchState.lossBonus = { T: 0, CT: 0 };
  }

  private handleOvertimeStart() {
      this.events.unshift("⚠️ OVERTIME STARTED (MR3)");
      this.matchState.winThreshold += 3;

      this.matchState.lossBonus = { T: 0, CT: 0 };

      // Reset Money to $16,000 for everyone
      this.bots.forEach(bot => {
          if (bot.player.inventory) {
              bot.player.inventory.money = ECONOMY.OT_MR12_MONEY;
              // Should we reset weapons? "Start MR3 with $16,000 starting cash."
              // Implies fresh start.
              bot.player.inventory.hasKevlar = false;
              bot.player.inventory.hasHelmet = false;
              bot.player.inventory.hasKit = false;
              bot.player.inventory.utilities = [];
              bot.player.inventory.primaryWeapon = undefined;
              bot.player.inventory.secondaryWeapon = undefined;
          }
      });
  }

  private broadcast() {
    this.onUpdate({
      bots: this.bots,
      tickCount: this.tickCount,
      events: this.events,
      stats: this.stats,
      matchState: this.matchState,
      bombState: this.bombState,
      roundTimer: this.roundTimer
    });
  }
}
