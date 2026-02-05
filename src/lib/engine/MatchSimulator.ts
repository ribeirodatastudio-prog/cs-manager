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
import { EventManager } from "./EventManager";

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
  private bombPlantTick: number = 0;
  private eventManager: EventManager;

  // Config
  private speedMultiplier: number = 1.0;
  private baseTickRate: number = 100; // ms
  private readonly TICKS_PER_SEC = 10;
  private readonly ROUND_TIME = 115; // 1:55
  private readonly FREEZE_TIME = 5;

  constructor(players: Player[], onUpdate: (state: SimulationState) => void) {
    this.map = new GameMap(DUST2_MAP);
    this.tacticsManager = new TacticsManager();
    this.tickCount = 0;
    this.isRunning = false;
    this.onUpdate = onUpdate;
    this.events = [];
    this.eventManager = new EventManager();

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
      return new Bot(p, side, spawn!.id, this.eventManager);
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
            b.player.inventory.hasDefuseKit = false;
            b.player.inventory.grenades = [];
            b.player.inventory.primaryWeapon = undefined;
            b.player.inventory.secondaryWeapon = b.side === TeamSide.T ? "glock-18" : "usp-s";
        }
    });

    this.startRound();
    this.broadcast();
  }

  private startRound() {
    // Reset Map Objects
    // Reset Map Cover (Molotov effects)
    this.map = new GameMap(JSON.parse(JSON.stringify(DUST2_MAP)));
    this.bomb.reset();
    this.roundTimer = this.ROUND_TIME;
    this.roundKills = 0; // Reset kills for the round
    this.bombPlantTick = 0;
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

    // Log Financial State
    const tMoney = this.bots.filter(b => b.side === TeamSide.T).reduce((acc, b) => acc + (b.player.inventory?.money || 0), 0);
    const ctMoney = this.bots.filter(b => b.side === TeamSide.CT).reduce((acc, b) => acc + (b.player.inventory?.money || 0), 0);
    const tLoss = ECONOMY.LOSS_BONUS_START + (this.matchState.lossBonus.T * ECONOMY.LOSS_BONUS_INCREMENT);
    const ctLoss = ECONOMY.LOSS_BONUS_START + (this.matchState.lossBonus.CT * ECONOMY.LOSS_BONUS_INCREMENT);

    this.events.unshift(`💰 Team Bank: T $${tMoney} (Next Min: $${tLoss}) | CT $${ctMoney} (Next Min: $${ctLoss})`);
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

  public tick() {
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

    // Fix: Bomb Timer Safety
    if (this.bomb.status === BombStatus.PLANTED) {
         if (this.tickCount - this.bombPlantTick > 405) { // 40.5s safety limit
             this.bomb.status = BombStatus.DETONATED;
             this.events.unshift(`⚠️ Bomb timer limit reached (Safety Force).`);
         }
    }

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
        // Add randomness to prevent predictable timing
        // Transition between 60-70 seconds to add variety
        const transitionTime = 60 + Math.floor(Math.random() * 11); // 60-70s

        if (this.roundTimer <= transitionTime || this.roundKills > 0) {
            const newTactic = Math.random() > 0.5 ? "EXECUTE_A" : "EXECUTE_B";
            this.tacticsManager.setTactic(TeamSide.T, newTactic);
            this.tacticsManager.updateAssignments(this.bots, this.map);
            this.events.unshift(`[Tactics] ⏱️ Default Phase Over. Transitioning to ${newTactic.replace("_", " ")}!`);
        }
    }


    // Pre-calculate zone occupancy for Capacity Logic
    const zoneOccupancy: Record<string, { T: number, CT: number }> = {};
    this.bots.forEach(b => {
        if (b.status === "DEAD") return;
        if (!zoneOccupancy[b.currentZoneId]) zoneOccupancy[b.currentZoneId] = { T: 0, CT: 0 };
        zoneOccupancy[b.currentZoneId][b.side]++;
    });

    // 6. Bots Decision
    this.bots.forEach(bot => {
      if (bot.status === "DEAD") return;

      // Check for Utility Finish
      if (bot.isChargingUtility && bot.utilityChargeTimer === 1) {
           const utilType = bot.activeUtility || "flashbang";
           const targetZone = bot.goalZoneId;

           // Remove from inventory
           if (bot.player.inventory) {
               const idx = bot.player.inventory.grenades.indexOf(utilType);
               if (idx !== -1) {
                   bot.player.inventory.grenades.splice(idx, 1);
               }
           }

           bot.utilityCooldown = 20;
           bot.hasThrownEntryUtility = true;

           const inventoryCount = bot.player.inventory?.grenades.filter(g => g === utilType).length ?? 0;
           const targetName = targetZone ? this.map.getZone(targetZone)?.name : "Unknown";
           this.events.unshift(`[Tick ${this.tickCount}] 🧨 ${bot.player.name} threw ${utilType.toUpperCase()} into ${targetName} (Inventory: ${inventoryCount})`);

           if (targetZone) {
               if (utilType === "flashbang") {
                   this.bots.forEach(victim => {
                       if (victim.status === "ALIVE" && victim.side !== bot.side && victim.currentZoneId === targetZone) {
                           victim.stunTimer = 20;
                       }
                   });
               } else if (utilType === "molotov" || utilType === "incendiary") {
                   const zone = this.map.getZone(targetZone);
                   if (zone) {
                       const skill = bot.player.skills.technical.utility;
                       if (Math.random() * 200 < skill) {
                           zone.cover = Math.max(0, zone.cover - 0.3);
                           this.events.unshift(`> 🔥 Molotov burned cover in ${targetName}!`);
                       }
                   }
               }
               // Smoke/HE Logic placeholders (Visual/Sound events usually)
           }
      }

      // Add Noise
      const noise = bot.makeNoise();
      if (this.zoneStates[bot.currentZoneId]) {
          this.zoneStates[bot.currentZoneId].noiseLevel += noise;
      }

      // Update Goal / AI State
      bot.updateGoal(this.map, this.bomb, this.tacticsManager, this.zoneStates, this.tickCount, this.bots);

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
           // Instant move logic (should respect capacity? Unlikely to happen in simulation but safe to skip for now)
           bot.currentZoneId = bot.targetZoneId!;
           bot.targetZoneId = null;
           bot.movementProgress = 0;
           if (bot.path.length > 0 && bot.path[0] === action.targetZoneId) {
             bot.path.shift();
           }
        } else {
           // Calculate Speed
           const effectiveSpeed = bot.getEffectiveSpeed(40);

           // Move amount per tick (0.1s)
           const moveAmount = effectiveSpeed * 0.1;

           bot.movementProgress += moveAmount;

           if (bot.movementProgress >= distance) {
               // Arrived - Check Zone Capacity
               const targetId = bot.targetZoneId!;
               const totalInTarget = (zoneOccupancy[targetId]?.T || 0) + (zoneOccupancy[targetId]?.CT || 0);

               // Fix: Disable Rerouting if Bomb Planted (Allow flooding)
               if (totalInTarget >= 4 && this.bomb.status !== BombStatus.PLANTED) {
                   // Zone Crowded - Reroute (Delay)
                   const zone = this.map.getZone(targetId);
                   if (zone) {
                       // Find a neighbor of the TARGET that is ALSO connected to CURRENT zone (valid move)
                       // Or just find a neighbor of CURRENT zone?
                       // User said "spill over into adjacent support positions". Support positions are usually adjacent to the target site.
                       // But we must be able to walk there.
                       // Try to find a neighbor of Target that is accessible from Current.
                       const validNeighbor = zone.connections.find(n => {
                           const count = (zoneOccupancy[n]?.T || 0) + (zoneOccupancy[n]?.CT || 0);
                           const dist = this.map.getDistance(bot.currentZoneId, n);
                           return count < 4 && dist !== Infinity;
                       });

                       if (validNeighbor) {
                           this.events.unshift(`[Tick ${this.tickCount}] 🚧 ${bot.player.name} rerouting from crowded ${zone.name} to ${this.map.getZone(validNeighbor)?.name}`);
                           bot.targetZoneId = validNeighbor;
                           bot.movementProgress = 0; // Reset progress (Walking to neighbor)
                           return;
                       }
                   }
                   // If no accessible neighbor found, stay put (wait at border)
                   // We clamp progress to just before arrival to simulate "blocked"
                   bot.movementProgress = Math.min(bot.movementProgress, distance - 0.1);
                   return;
               }

               // Capacity OK - Proceed to Enter

               // Entry Frag Logic
               const destOccupancy = zoneOccupancy[targetId] || { T: 0, CT: 0 };
               const enemies = bot.side === TeamSide.T ? destOccupancy.CT : destOccupancy.T;
               const friends = bot.side === TeamSide.T ? destOccupancy.T : destOccupancy.CT;

               if (enemies > 0 && friends === 0) {
                   bot.isEntryFragger = true;
                   this.events.unshift(`[Tick ${this.tickCount}] 💥 ${bot.player.name} ENTRY FRAGGING into ${this.map.getZone(targetId)?.name}! (-30% Precision)`);
               }

               // Update Occupancy for subsequent bots
               if (!zoneOccupancy[targetId]) zoneOccupancy[targetId] = { T: 0, CT: 0 };
               zoneOccupancy[targetId][bot.side]++;
               if (zoneOccupancy[bot.currentZoneId]) {
                   zoneOccupancy[bot.currentZoneId][bot.side]--;
               }

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
            this.bombPlantTick = this.tickCount;
            // Remove bomb from carrier inventory visually (handled by Bomb state)
             const carrier = this.bots.find(b => b.id === this.bomb.planterId);
             if (carrier) carrier.hasBomb = false;
        }
    } else if (this.bomb.status === BombStatus.DEFUSING) {
        const defuser = this.bots.find(b => b.id === this.bomb.defuserId);
        const hasDefuseKit = defuser?.player.inventory?.hasDefuseKit || false;
        if (this.bomb.updateDefusing(hasDefuseKit)) {
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

    const hasFired = new Set<string>(); // Track bots who have fired their weapon this tick
    const livingBots = this.bots.filter(b => b.status === "ALIVE");

    // Randomize turn order
    const attackers = [...livingBots].sort(() => Math.random() - 0.5);

    attackers.forEach(attacker => {
        if (attacker.status === "DEAD") return;
        if (hasFired.has(attacker.id)) return; // Attacker already fired

        // Skip if busy (planting/defusing/charging)
        // Verify against bomb state
        if (this.bomb.planterId === attacker.id) return;
        if (this.bomb.defuserId === attacker.id) return;
        if (attacker.aiState === BotAIState.CHARGING_UTILITY) return;
        if (attacker.combatCooldown > 0) return;

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

        // Check Engagement Queue / Firing Status
        const targetBusy = hasFired.has(target.id);

        // Mark Attacker as having fired
        hasFired.add(attacker.id);

        // If target is NOT busy, they return fire.
        if (!targetBusy) {
            hasFired.add(target.id);
        } else {
             // Target cannot return fire (One-way duel)
             // We allow the duel, but target deals 0 damage / skips their turn in DuelEngine?
             // Actually DuelEngine simulates both sides.
             // We need to pass a flag to DuelEngine to disable target's attack?
             // Or just handle it here?
             // DuelEngine.calculateOutcome calls simulateEngagement for both.
             // We can modify DuelEngine to accept 'targetCanFire' boolean?
             // Or just log it and accept that DuelEngine might simulate a return fire that we ignore?
             // The cleanest way is to add `targetCanFire` to calculateOutcome.
             // But I can't modify DuelEngine signature easily without checking everywhere.
             // Wait, I *can* modify DuelEngine.
             // Let's modify DuelEngine signature in a moment.
             // For now, let's assume I will.
        }

        // Notify Enemy Spotted (Both ways)
        // Only if not already spotted recently? Bot handles duplicates via timestamp logic usually, but here we spam it.
        // Let's rely on EventManager to handle listeners.
        this.eventManager.publish({
            type: "ENEMY_SPOTTED",
            zoneId: target.currentZoneId,
            timestamp: this.tickCount,
            enemyCount: 1, // At least 1
            spottedBy: attacker.id
        });

        // Target also spots attacker
        this.eventManager.publish({
            type: "ENEMY_SPOTTED",
            zoneId: attacker.currentZoneId,
            timestamp: this.tickCount,
            enemyCount: 1,
            spottedBy: target.id
        });

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

        // Calculate Outcome
        // If targetBusy is true, target cannot return fire.
        // I need to update DuelEngine.calculateOutcome to support this.
        const result = DuelEngine.calculateOutcome(attacker, target, targetInfo.distance, targetInfo.isCrossZone, !targetBusy);

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
            const weapon = winner.getEquippedWeapon();
            const weaponName = weapon ? weapon.name : "Unknown";

            // Kill Reward
            let reward = 300;
            if (weapon) {
                reward = EconomySystem.getKillReward(weapon);
            }
            if (winner.player.inventory) {
                winner.player.inventory.money = Math.min(ECONOMY.MAX_MONEY, winner.player.inventory.money + reward);
            }

            this.events.unshift(`💀 [${weaponName}] ${loser.player.name} eliminated by ${winner.player.name} (+$${reward})`);
            this.stats[winner.id].kills++;
            this.stats[winner.id].actualKills++;
            this.stats[loser.id].deaths++;
            this.roundKills++;

            // Trigger Teammate Died Event
            this.eventManager.publish({
                type: "TEAMMATE_DIED",
                zoneId: loser.currentZoneId,
                timestamp: this.tickCount,
                victimId: loser.id,
                killerId: winner.id
            });

            // Apply Combat Delay (Target Acquisition)
            // Delay (ticks) = Math.max(2, 6 - (ReactionTime + Dexterity) / 50)
            const rxn = winner.player.skills.physical.reactionTime;
            const dex = winner.player.skills.physical.dexterity;
            const delay = Math.max(2, Math.floor(6 - (rxn + dex) / 50));
            winner.combatCooldown = delay;

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
          const income = EconomySystem.calculateIncome(
              bot.side,
              winner,
              reason,
              this.matchState.lossBonus[bot.side],
              // Bomb planted check
              this.bomb.status === BombStatus.PLANTED || this.bomb.status === BombStatus.DETONATED || this.bomb.status === BombStatus.DEFUSED,
              bot.status === "ALIVE"
          );
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
              bot.player.inventory.hasDefuseKit = false;
              bot.player.inventory.grenades = [];
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
              bot.player.inventory.hasDefuseKit = false;
              bot.player.inventory.grenades = [];
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
