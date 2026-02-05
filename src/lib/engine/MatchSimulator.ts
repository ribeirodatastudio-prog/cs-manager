import { Bot, BotAIState } from "./Bot";
import { GameMap } from "./GameMap";
import { TacticsManager, TeamSide, Tactic } from "./TacticsManager";
import { DuelEngine } from "./DuelEngine";
import { Player } from "@/types";
import { DUST2_MAP } from "./maps/dust2";
import { MatchState, MatchPhase, RoundEndReason, BuyStrategy } from "./types";
import { EconomySystem } from "./EconomySystem";
import { BuyLogic } from "./BuyLogic";
import { ECONOMY } from "./constants";
import { Bomb, BombStatus } from "./Bomb";

export interface PlayerStats {
  kills: number;
  deaths: number;
  damageDealt: number;
  assists: number;
  expectedKills: number;
  actualKills: number;
}

export interface ZoneState {
    noiseLevel: number;
}

export interface SimulationState {
  bots: Bot[];
  tickCount: number;
  events: string[];
  stats: Record<string, PlayerStats>;
  matchState: MatchState;
  bombState: Bomb; // Use Bomb class instance
  roundTimer: number; // Seconds
  zoneStates: Record<string, ZoneState>;
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
  public bomb: Bomb;
  public roundTimer: number;
  public zoneStates: Record<string, ZoneState> = {};
  private roundKills: number = 0; // Kills this round

  // Config
  private speedMultiplier: number = 1.0;
  private baseTickRate: number = 500; // ms
  private readonly TICKS_PER_SEC = 2;
  private readonly ROUND_TIME = 115; // 1:55
  private readonly FREEZE_TIME = 5;

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

    this.bomb = new Bomb();
    this.roundTimer = this.ROUND_TIME;

    // Initialize Zone States
    this.map.data.zones.forEach(z => {
        this.zoneStates[z.id] = { noiseLevel: 0 };
    });

    // Initialize Bots
    this.bots = players.map((p, i) => {
      const side = i % 2 === 0 ? TeamSide.T : TeamSide.CT;
      const spawn = this.map.getSpawnPoint(side);
      return new Bot(p, side, spawn!.id);
    });

    // Init Stats
    this.bots.forEach(b => {
      this.stats[b.player.id] = { kills: 0, deaths: 0, damageDealt: 0, assists: 0, expectedKills: 0, actualKills: 0 };
    });

    // Start in Freeze Time
    this.startRound();
    this.broadcast();
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
            b.player.inventory.secondaryWeapon = b.side === TeamSide.T ? "glock-18" : "usp-s";
        }
    });

    this.startRound();
    this.broadcast();
  }

  private startRound() {
    // Reset Map Objects
    this.bomb.reset();
    this.roundTimer = this.ROUND_TIME;
    this.roundKills = 0; // Reset kills for the round
    this.matchState.phase = MatchPhase.PAUSED_FOR_STRATEGY; // Pause for strategy
    this.matchState.phaseTimer = this.FREEZE_TIME;

    // Reset Zone Noise
    Object.keys(this.zoneStates).forEach(key => this.zoneStates[key].noiseLevel = 0);

    // Respawn Bots
    this.bots.forEach(bot => {
      bot.hp = 100;
      bot.status = "ALIVE";
      bot.aiState = BotAIState.DEFAULT;
      bot.reactionTimer = 0;
      bot.hasBomb = false;
      bot.path = [];
      bot.isShiftWalking = false;
      bot.isChargingUtility = false;
      bot.utilityChargeTimer = 0;
      const spawn = this.map.getSpawnPoint(bot.side);
      bot.currentZoneId = spawn!.id;
    });

    // Assign Bomb to random T
    const ts = this.bots.filter(b => b.side === TeamSide.T);
    if (ts.length > 0) {
        const carrier = ts[Math.floor(Math.random() * ts.length)];
        carrier.hasBomb = true;
        this.bomb.pickup(carrier.id);
        this.events.unshift(`[Round ${this.matchState.round}] 💣 ${carrier.player.name} has the bomb.`);
    }

    // Update Assignments (Default)
    this.tacticsManager.updateAssignments(this.bots, this.map);

    // Note: Buy Logic is now deferred to applyStrategies
  }

  public applyStrategies(tStrategy: BuyStrategy, tTactic: Tactic, ctStrategy: BuyStrategy, ctTactic: Tactic) {
    // 1. Set Tactics
    this.tacticsManager.setTactic(TeamSide.T, tTactic);
    this.tacticsManager.setTactic(TeamSide.CT, ctTactic);

    // Update Assignments based on new tactics
    this.tacticsManager.updateAssignments(this.bots, this.map);

    // 2. Execute Buy Logic
    this.bots.forEach(bot => {
      if (bot.player.inventory) {
        const strategy = bot.side === TeamSide.T ? tStrategy : ctStrategy;
        BuyLogic.processBuy(bot.player.inventory, bot.side, bot.player.role, strategy);
      }
    });

    // 3. Start Freezetime
    this.matchState.phase = MatchPhase.FREEZETIME;
    this.events.unshift("🛒 Buy Phase / Strategy Confirmed.");
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
    if (this.matchState.phase === MatchPhase.PAUSED_FOR_STRATEGY) {
      this.broadcast();
      return;
    }

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
    // 1. Update Timer
    if (this.tickCount % this.TICKS_PER_SEC === 0) {
        if (this.bomb.status === BombStatus.PLANTED || this.bomb.status === BombStatus.DEFUSING) {
             // Round timer stops or ignored when bomb planted, we show bomb timer
        } else {
             this.roundTimer--;
        }
    }

    // 2. Bomb Logic Tick
    this.bomb.tick();

    // 3. Update Noise Levels (Decay)
    Object.values(this.zoneStates).forEach(state => {
        state.noiseLevel = Math.max(0, state.noiseLevel - 5); // Decay 5 per tick
    });

    // 4. Split Strategy Coordination
    const tTactic = this.tacticsManager.getTactic(TeamSide.T);
    if (tTactic.includes("SPLIT") && this.tacticsManager.getStage(TeamSide.T) === "SETUP") {
        // Check if all T bots are at their assigned pincer point (or dead)
        const tBots = this.bots.filter(b => b.side === TeamSide.T && b.status === "ALIVE");
        let allReady = true;
        for (const bot of tBots) {
            const goal = this.tacticsManager.getGoalZone(bot, this.map); // Returns pincer point in SETUP
            if (bot.currentZoneId !== goal) {
                allReady = false;
                break;
            }
        }

        if (allReady && tBots.length > 0) {
            this.tacticsManager.setStage(TeamSide.T, "EXECUTE");
            this.events.unshift(`[Tactics] 🔄 Split Groups Synchronized. Executing Site Push!`);
        }
    }

    // 5. Default Strategy Transition (Stall Fix)
    if (tTactic === "DEFAULT") {
        // Check if round timer < 45s or kills > 0
        if (this.roundTimer <= 45 || this.roundKills > 0) {
            // Check if we already transitioned? (Wait, tacticsManager still has DEFAULT)
            // So we transition now.
            const newTactic = Math.random() > 0.5 ? "EXECUTE_A" : "EXECUTE_B";
            this.tacticsManager.setTactic(TeamSide.T, newTactic);
            this.tacticsManager.updateAssignments(this.bots, this.map);
            this.events.unshift(`[Tactics] ⏱️ Default Phase Over. Transitioning to ${newTactic.replace("_", " ")}!`);
        }
    }


    // 6. Bots Decision
    this.bots.forEach(bot => {
      if (bot.status === "DEAD") return;

      // Add Noise
      const noise = bot.makeNoise();
      if (this.zoneStates[bot.currentZoneId]) {
          this.zoneStates[bot.currentZoneId].noiseLevel += noise;
      }

      // Update Goal / AI State
      bot.updateGoal(this.map, this.bomb, this.tacticsManager, this.zoneStates);

      // Get Action
      const action = bot.decideAction(this.map);

      if (action.type === "MOVE" && action.targetZoneId) {
        // Initialize movement if new target
        if (bot.targetZoneId !== action.targetZoneId) {
           bot.targetZoneId = action.targetZoneId;
           bot.movementProgress = 0;
        }

        const distance = this.map.getDistance(bot.currentZoneId, bot.targetZoneId!);

        // Handle instant move (fallback) or granular move
        if (distance === Infinity || distance <= 0) {
           bot.currentZoneId = bot.targetZoneId!;
           bot.targetZoneId = null;
           bot.movementProgress = 0;
           if (bot.path.length > 0 && bot.path[0] === action.targetZoneId) {
             bot.path.shift();
           }
        } else {
           // Calculate Speed
           const effectiveSpeed = bot.getEffectiveSpeed(40);

           // Move amount per tick (0.5s)
           const moveAmount = effectiveSpeed * 0.5;

           bot.movementProgress += moveAmount;

           if (bot.movementProgress >= distance) {
               // Arrived
               bot.currentZoneId = bot.targetZoneId!;
               bot.targetZoneId = null;
               bot.movementProgress = 0;
               if (bot.path.length > 0 && bot.path[0] === action.targetZoneId) {
                  bot.path.shift();
               }
           }
        }

      } else {
        // Not moving, reset state
        bot.targetZoneId = null;
        bot.movementProgress = 0;

        if (action.type === "PLANT") {
          // Attempt start planting
          if (this.bomb.status === BombStatus.IDLE) {
              this.bomb.startPlanting(bot.id, bot.currentZoneId);
          }
      } else if (action.type === "DEFUSE") {
          // Attempt start defusing
          if (this.bomb.status === BombStatus.PLANTED) {
              this.bomb.startDefusing(bot.id);
          }
      }
      // Check Charge Action
      else if (action.type === "CHARGE_UTILITY") {
          // Just waiting, maybe log event once?
          // Bot status is CHARGING_UTILITY
      }
      }
    });

    // 7. Resolve Combat (may interrupt planting/defusing)
    this.resolveCombat();

    // 8. Update Bomb Progress (Plant/Defuse)
    if (this.bomb.status === BombStatus.PLANTING) {
        if (this.bomb.updatePlanting()) {
            this.events.unshift(`[Tick ${this.tickCount}] 💣 BOMB PLANTED at ${this.bomb.plantSite === this.map.data.bombSites.A ? "A" : "B"}!`);
            this.events.unshift(`⏱️ 40 seconds to explosion!`);
            // Remove bomb from carrier inventory visually (handled by Bomb state)
             const carrier = this.bots.find(b => b.id === this.bomb.planterId);
             if (carrier) carrier.hasBomb = false;
        }
    } else if (this.bomb.status === BombStatus.DEFUSING) {
        const defuser = this.bots.find(b => b.id === this.bomb.defuserId);
        const hasKit = defuser?.player.inventory?.hasKit || false;
        if (this.bomb.updateDefusing(hasKit)) {
             // Defused! handled in checkWinConditions or here
             // We'll let checkWinConditions handle it via status
        }
    }

    // 9. Check Win Conditions
    this.checkWinConditions();
  }

  private resolveCombat() {
    // 1. Map bots to zones
    const zoneOccupants: Record<string, Bot[]> = {};
    this.bots.forEach(bot => {
      if (bot.status === "DEAD") return;
      if (!zoneOccupants[bot.currentZoneId]) zoneOccupants[bot.currentZoneId] = [];
      zoneOccupants[bot.currentZoneId].push(bot);
    });

    const foughtThisTick = new Set<string>();
    const livingBots = this.bots.filter(b => b.status === "ALIVE");

    // Randomize turn order
    const attackers = [...livingBots].sort(() => Math.random() - 0.5);

    attackers.forEach(attacker => {
        if (attacker.status === "DEAD") return;
        if (foughtThisTick.has(attacker.id)) return;

        // Skip if busy (planting/defusing/charging)
        // Verify against bomb state
        if (this.bomb.planterId === attacker.id) return;
        if (this.bomb.defuserId === attacker.id) return;
        if (attacker.aiState === BotAIState.CHARGING_UTILITY) return;

        // Find potential targets:
        // 1. In same zone
        // 2. In connected zones (Neighbors)
        const currentZone = this.map.getZone(attacker.currentZoneId);
        if (!currentZone) return;

        const potentialTargets: { bot: Bot; distance: number; isCrossZone: boolean }[] = [];

        // Same Zone Targets (Distance ~ 100)
        const sameZoneEnemies = (zoneOccupants[attacker.currentZoneId] || [])
            .filter(b => b.side !== attacker.side && b.status === "ALIVE");

        sameZoneEnemies.forEach(enemy => {
            potentialTargets.push({ bot: enemy, distance: 100, isCrossZone: false });
        });

        // Neighbor Zone Targets
        currentZone.connections.forEach(connId => {
            const enemiesInConn = (zoneOccupants[connId] || [])
                .filter(b => b.side !== attacker.side && b.status === "ALIVE");

            if (enemiesInConn.length > 0) {
                 const dist = this.map.getDistance(attacker.currentZoneId, connId);
                 enemiesInConn.forEach(enemy => {
                     potentialTargets.push({ bot: enemy, distance: dist, isCrossZone: true });
                 });
            }
        });

        if (potentialTargets.length === 0) return;

        // Pick a target
        // Prefer same zone? Or just random? Random for now.
        const targetInfo = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
        const target = targetInfo.bot;

        foughtThisTick.add(attacker.id);

        // Interrupt logic
        if (this.bomb.planterId === target.id) {
            this.bomb.abortPlanting();
            target.aiState = BotAIState.DEFAULT;
        }
        if (this.bomb.defuserId === target.id) {
            this.bomb.abortDefusing();
            target.aiState = BotAIState.DEFAULT;
        }
        if (target.aiState === BotAIState.CHARGING_UTILITY) {
            target.aiState = BotAIState.DEFAULT;
            target.isChargingUtility = false;
            target.utilityChargeTimer = 0;
        }

        // Shooting adds NOISE
        if (this.zoneStates[attacker.currentZoneId]) {
            this.zoneStates[attacker.currentZoneId].noiseLevel += 50;
        }

        const probs = DuelEngine.getWinProbability(attacker, target, targetInfo.distance, 20);
        this.stats[attacker.id].expectedKills += probs.initiatorWinRate;

        // Calculate Outcome with crossZone flag
        // We need to update DuelEngine to accept isCrossZone
        const result = DuelEngine.calculateOutcome(attacker, target, targetInfo.distance, targetInfo.isCrossZone);

        const winner = result.winnerId === attacker.id ? attacker : target;
        const loser = result.winnerId === attacker.id ? target : attacker;

        loser.takeDamage(result.damage);
        this.stats[winner.id].damageDealt += result.damage;

        const locationStr = targetInfo.isCrossZone
            ? `${currentZone.name} -> ${this.map.getZone(target.currentZoneId)?.name}`
            : currentZone.name;

        this.events.unshift(`[Tick ${this.tickCount}] ⚔️ ${attacker.player.name} vs ${target.player.name} (${locationStr})`);

        if (result.publicLog && result.publicLog.length > 0) {
            result.publicLog.forEach(log => this.events.unshift(`> ${log}`));
        }

        if (loser.hp <= 0) {
            this.events.unshift(`💀 ${loser.player.name} eliminated by ${winner.player.name}`);
            this.stats[winner.id].kills++;
            this.stats[winner.id].actualKills++;
            this.stats[loser.id].deaths++;
            this.roundKills++;

            if (this.bomb.carrierId === loser.id) {
                loser.hasBomb = false;
                this.bomb.drop(loser.currentZoneId);
                this.events.unshift(`⚠️ Bomb dropped at ${this.map.getZone(loser.currentZoneId)?.name}!`);
            }
            if (this.bomb.defuserId === loser.id) this.bomb.abortDefusing();
            if (this.bomb.planterId === loser.id) this.bomb.abortPlanting();
        }
    });
  }

  private checkWinConditions() {
      // 1. Bomb Detonated
      if (this.bomb.status === BombStatus.DETONATED) {
          this.endRound(TeamSide.T, RoundEndReason.TARGET_BOMBED);
          return;
      }
      // 2. Bomb Defused
      if (this.bomb.status === BombStatus.DEFUSED) {
          this.endRound(TeamSide.CT, RoundEndReason.BOMB_DEFUSED);
          return;
      }

      // 3. Time Running Out (Only if bomb NOT planted/planting/defusing check? No, timer check logic handled in tick)
      // Actually, if bomb is planted, roundTimer is ignored.
      if (this.bomb.status === BombStatus.IDLE || this.bomb.status === BombStatus.PLANTING) {
          if (this.roundTimer <= 0) {
              this.endRound(TeamSide.CT, RoundEndReason.TIME_RUNNING_OUT);
              return;
          }
      }

      // 4. Elimination
      const tAlive = this.bots.filter(b => b.side === TeamSide.T && b.status === "ALIVE").length;
      const ctAlive = this.bots.filter(b => b.side === TeamSide.CT && b.status === "ALIVE").length;

      if (tAlive === 0) {
           if (this.bomb.status === BombStatus.PLANTED || this.bomb.status === BombStatus.DEFUSING) {
               // CTs must defuse to win.
               // If no CTs are defusing and time runs out -> T win (Detonated)
               // But elimination doesn't end round if bomb is planted.
           } else {
               this.endRound(TeamSide.CT, RoundEndReason.ELIMINATION_T);
           }
      }
      if (ctAlive === 0) {
           // T win unless bomb planted? If bomb planted, T wins automatically (CTs dead, can't defuse)
           // But tecnically we wait for boom or just award win.
           // CS logic: If all CTs dead, T wins immediately (Elimination).
           // UNLESS bomb is planted? If bomb planted, T wins (Target Bombed?) or Elimination?
           // Usually Elimination if boom hasn't happened.
           // However, if bomb is planted, we often wait for detonation visually, but the round is decided.
           // Let's end it as ELIMINATION_CT.
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
      const loser = winner === TeamSide.T ? TeamSide.CT : TeamSide.T;
      this.matchState.lossBonus[loser] = EconomySystem.updateLossBonus(this.matchState.lossBonus[loser], false);

      if (this.matchState.round === 1 || this.matchState.round === 13) {
          if (winner === TeamSide.T) this.matchState.lossBonus.CT = EconomySystem.getPistolRoundLossLevel();
          else this.matchState.lossBonus.T = EconomySystem.getPistolRoundLossLevel();
      }

      this.bots.forEach(bot => {
          if (!bot.player.inventory) return;
          let income = EconomySystem.calculateIncome(
              bot.side,
              winner,
              reason,
              this.matchState.lossBonus[bot.side],
              // Bomb planted check
              this.bomb.status === BombStatus.PLANTED || this.bomb.status === BombStatus.DETONATED || this.bomb.status === BombStatus.DEFUSED
              // Actually EconomySystem just checks boolean isPlanted.
              // So if it was planted at any point?
              // Usually if T loses but planted, they get bonus.
              // If T wins via Explosion, they get win money.
          );
          // Special case: T survives after time runs out -> $0 income
          if (bot.side === TeamSide.T && bot.status === "ALIVE" && reason === RoundEndReason.TIME_RUNNING_OUT) {
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
          bot.side = bot.side === TeamSide.T ? TeamSide.CT : TeamSide.T;
          if (bot.player.inventory) {
              bot.player.inventory.money = startMoney;
              bot.player.inventory.hasKevlar = false;
              bot.player.inventory.hasHelmet = false;
              bot.player.inventory.hasKit = false;
              bot.player.inventory.utilities = [];
              bot.player.inventory.primaryWeapon = undefined;
              bot.player.inventory.secondaryWeapon = bot.side === TeamSide.T ? "glock-18" : "usp-s";
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
              bot.player.inventory.secondaryWeapon = bot.side === TeamSide.T ? "glock-18" : "usp-s";
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
      bombState: this.bomb, // Pass Bomb instance
      roundTimer: this.roundTimer,
      zoneStates: this.zoneStates // Pass zoneStates
    });
  }
}
