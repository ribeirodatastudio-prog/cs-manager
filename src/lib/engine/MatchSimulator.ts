import { Bot, BotAIState } from "./Bot";
import { GameMap } from "./GameMap";
import { Pathfinder } from "./Pathfinder";
import { TacticsManager, TeamSide, Tactic } from "./TacticsManager";
import { DuelEngine, DuelResult, ParticipantResult } from "./DuelEngine";
import { Player } from "@/types";
import { DUST2_MAP } from "./maps/dust2";
import { MatchState, MatchPhase, RoundEndReason, BuyStrategy, DroppedWeapon } from "./types";
import { EconomySystem } from "./EconomySystem";
import { TeamEconomyManager } from "./TeamEconomyManager";
import { ECONOMY, WEAPONS, WeaponType } from "./constants";
import { WeaponUtils } from "./WeaponUtils";
import { Bomb, BombStatus } from "./Bomb";
import { EventManager } from "./EventManager";
import { Weapon } from "@/types/Weapon";
import { EngagementContext, PeekType } from "./engagement";

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
    droppedWeapons: DroppedWeapon[];
    smokedUntilTick?: number;
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

  private roundStateMetrics = {
    tLastProgressed: 0,
    tStuckCounter: 0,
    lastContactZone: null as string | null,
    lastTacticChange: 0
  };

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
        this.zoneStates[z.id] = { noiseLevel: 0, droppedWeapons: [] };
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

    // Reset Zone Noise and Dropped Weapons
    Object.keys(this.zoneStates).forEach(key => {
        this.zoneStates[key].noiseLevel = 0;
        this.zoneStates[key].droppedWeapons = [];
        this.zoneStates[key].smokedUntilTick = 0;
    });

    // Respawn Bots
    this.bots.forEach(bot => {
      const wasDead = bot.status === "DEAD";

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

      // Inventory Persistence Logic
      if (wasDead) {
          // Died: Reset Inventory but KEEP MONEY
          if (bot.player.inventory) {
              const savedMoney = bot.player.inventory.money;
              bot.player.inventory = {
                  money: savedMoney,
                  hasKevlar: false,
                  hasHelmet: false,
                  hasDefuseKit: false,
                  grenades: [],
                  primaryWeapon: undefined,
                  secondaryWeapon: bot.side === TeamSide.T ? "glock-18" : "usp-s"
              };
          }
      } else {
          // Survived: Keep Inventory
          // Ensure secondary weapon exists (Mandatory Pistol)
          if (bot.player.inventory) {
              if (!bot.player.inventory.secondaryWeapon) {
                  bot.player.inventory.secondaryWeapon = bot.side === TeamSide.T ? "glock-18" : "usp-s";
              }
              // Reset Grenades? No, survivors keep utility in CS.
          }
      }
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
  }

  public applyStrategies(tStrategy: BuyStrategy, tTactic: Tactic, ctStrategy: BuyStrategy, ctTactic: Tactic, roleOverrides: Record<string, string>, buyOverrides: Record<string, BuyStrategy> = {}) {
    // 1. Pass Overrides to TacticsManager
    this.tacticsManager.setRoleAssignments(roleOverrides);

    // 2. Set Tactics
    this.tacticsManager.setTactic(TeamSide.T, tTactic);
    this.tacticsManager.setTactic(TeamSide.CT, ctTactic);

    // Update Assignments based on new tactics and roles
    // This will effectively set bot.roundRole based on the tactic definitions
    this.tacticsManager.updateAssignments(this.bots, this.map);

    // 3. Execute Team Buy Logic
    const tBots = this.bots.filter(b => b.side === TeamSide.T);
    const ctBots = this.bots.filter(b => b.side === TeamSide.CT);

    TeamEconomyManager.executeTeamBuy(tBots, tStrategy, TeamSide.T, buyOverrides);
    TeamEconomyManager.executeTeamBuy(ctBots, ctStrategy, TeamSide.CT, buyOverrides);

    // 4. Start Freezetime
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

    this.evaluateTacticTransition();

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

    // 5. Default Strategy Transition -> Handled by evaluateTacticTransition()

    // 5.5 Detect Enemies (Info War)
    this.detectEnemies();

    // Force updates to Bomb State before Bots decide
    // Ensure Bomb Carrier logic handles bomb correctly
    if (this.bomb.status === BombStatus.IDLE && this.bomb.droppedLocation) {
         // Check for Pickup (redundant with Bot logic but ensures update)
         const botsAtBomb = this.bots.filter(b => b.status === "ALIVE" && b.currentZoneId === this.bomb.droppedLocation && b.side === TeamSide.T);
         if (botsAtBomb.length > 0) {
             const picker = botsAtBomb[0];
             this.bomb.pickup(picker.id);
             picker.hasBomb = true;
             this.events.unshift(`[Round ${this.matchState.round}] 💣 ${picker.player.name} recovered the bomb!`);
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
                           const utilSkill = bot.player.skills.technical.utility;
                           const composure = victim.player.skills.mental.composure;
                           let stun = 20 + (utilSkill / 10) - (composure / 10);
                           stun = Math.max(5, stun);
                           victim.stunTimer = Math.floor(stun);
                       }
                   });
               } else if (utilType === "smoke") {
                   if (!this.zoneStates[targetZone]) {
                       this.zoneStates[targetZone] = { noiseLevel: 0, droppedWeapons: [] };
                   }
                   this.zoneStates[targetZone].smokedUntilTick = this.tickCount + 180; // 18 seconds
                   this.events.unshift(`> ☁️ Smoke popped in ${targetName}!`);
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
      const action = bot.decideAction(this.map, this.zoneStates, this.roundTimer);

      if (action.type === "PICKUP_WEAPON") {
          const zoneDrops = this.zoneStates[bot.currentZoneId]?.droppedWeapons || [];
          if (zoneDrops.length > 0) {
              // Logic to pick best weapon
              let bestDropIndex = -1;
              let bestTier = -1;

              zoneDrops.forEach((d, idx) => {
                  const w = WeaponUtils.getWeaponTier(WEAPONS[d.weaponId].type);
                  if (w > bestTier) {
                      bestTier = w;
                      bestDropIndex = idx;
                  }
              });

              if (bestDropIndex !== -1) {
                  const drop = zoneDrops[bestDropIndex];
                  const newWeaponId = drop.weaponId;
                  const newWeaponType = WEAPONS[newWeaponId].type;
                  const isPistol = newWeaponType === WeaponType.PISTOL;

                  // Drop current weapon in that slot
                  const oldWeaponId = isPistol ? bot.player.inventory?.secondaryWeapon : bot.player.inventory?.primaryWeapon;

                  if (oldWeaponId) {
                      const zone = this.map.getZone(bot.currentZoneId);
                      this.zoneStates[bot.currentZoneId].droppedWeapons.push({
                          id: `drop_${this.tickCount}_swap_${bot.id}`,
                          weaponId: oldWeaponId,
                          zoneId: bot.currentZoneId,
                          x: (zone?.x || 500) + (Math.random() * 40 - 20),
                          y: (zone?.y || 500) + (Math.random() * 40 - 20)
                      });
                  }

                  // Equip
                  if (bot.player.inventory) {
                      if (isPistol) bot.player.inventory.secondaryWeapon = newWeaponId;
                      else bot.player.inventory.primaryWeapon = newWeaponId;
                  }

                  // Remove picked up weapon
                  this.zoneStates[bot.currentZoneId].droppedWeapons.splice(bestDropIndex, 1);

                  // Set Timer
                  bot.weaponSwapTimer = 5;
                  this.events.unshift(`[Tick ${this.tickCount}] 🎒 ${bot.player.name} picked up ${WEAPONS[newWeaponId].name}`);
              }
          }
      }
      else if (action.type === "MOVE" && action.targetZoneId) {
        // Initialize movement if new target
        if (bot.targetZoneId !== action.targetZoneId) {
           bot.targetZoneId = action.targetZoneId;
           bot.movementProgress = 0;
        }

        const distance = this.map.getDistance(bot.currentZoneId, bot.targetZoneId!);

        // Handle instant move (fallback) or granular move
        if (distance === Infinity || distance <= 0) {
           // Instant move logic
           bot.currentZoneId = bot.targetZoneId!;
           bot.targetZoneId = null;
           bot.movementProgress = 0;
           if (bot.path.length > 0 && bot.path[0] === action.targetZoneId) {
             bot.path.shift();
           }
        } else {
           // Calculate Speed
           const effectiveSpeed = bot.getEffectiveSpeed(40, this.roundTimer);

           // Move amount per tick (0.1s)
           const moveAmount = effectiveSpeed * 0.1;

           bot.movementProgress += moveAmount;
           console.log(`${bot.player.name} progress: ${bot.movementProgress}/${distance}`);

           if (bot.movementProgress >= distance) {
               // Arrived - Check Zone Capacity
               const targetId = bot.targetZoneId!;
               const totalInTarget = (zoneOccupancy[targetId]?.T || 0) + (zoneOccupancy[targetId]?.CT || 0);

               // VIP Pass: Bomb carrier ignores capacity
               const isVip = bot.hasBomb;

               // Fix: Disable Rerouting if Bomb Planted (Allow flooding)
               if (totalInTarget >= 4 && this.bomb.status !== BombStatus.PLANTED) {
                   if (isVip) {
                       // VIP Displacement Logic
                       const friendlyBotsInTarget = this.bots.filter(b =>
                           b.status === "ALIVE" &&
                           b.currentZoneId === targetId &&
                           b.side === bot.side &&
                           b.id !== bot.id
                       );

                       if (friendlyBotsInTarget.length > 0) {
                            // Sort by Clutching Skill (Ascending) -> Lowest moves
                            friendlyBotsInTarget.sort((a, b) => a.player.skills.technical.clutching - b.player.skills.technical.clutching);
                            const victim = friendlyBotsInTarget[0];

                            const zone = this.map.getZone(targetId);
                            if (zone) {
                                 let validNeighbor = zone.connections.find(n => {
                                     // n is a Connection object now
                                     const count = (zoneOccupancy[n.to]?.T || 0) + (zoneOccupancy[n.to]?.CT || 0);
                                     return count < 4;
                                 });

                                 // Fallback: Force displacement to ANY neighbor if all are crowded
                                 if (!validNeighbor && zone.connections.length > 0) {
                                     validNeighbor = zone.connections[0];
                                 }

                                 if (validNeighbor) {
                                     const neighborName = this.map.getZone(validNeighbor.to)?.name;
                                     this.events.unshift(`[VIP] 🚨 ${victim.player.name} displaced to ${neighborName} to make room for carrier ${bot.player.name}`);

                                     if (zoneOccupancy[targetId]) zoneOccupancy[targetId][victim.side]--;
                                     if (!zoneOccupancy[validNeighbor.to]) zoneOccupancy[validNeighbor.to] = {T:0, CT:0};
                                     zoneOccupancy[validNeighbor.to][victim.side]++;

                                     victim.currentZoneId = validNeighbor.to;
                                     victim.targetZoneId = null;
                                     victim.movementProgress = 0;
                                     victim.path = [];
                                 } else {
                                     this.events.unshift(`[VIP] 🚨 ${bot.player.name} forced entry into ${zone.name} (Overcrowded)`);
                                 }
                            }
                       }
                   } else {
                       // Zone Crowded - Reroute (Delay)
                       const zone = this.map.getZone(targetId);
                       if (zone) {
                           // Find a neighbor of the TARGET that is ALSO connected to CURRENT zone (valid move)
                           const validNeighbor = zone.connections.find(n => {
                               const count = (zoneOccupancy[n.to]?.T || 0) + (zoneOccupancy[n.to]?.CT || 0);
                               const dist = this.map.getDistance(bot.currentZoneId, n.to);
                               return count < 4 && dist !== Infinity;
                           });

                           if (validNeighbor) {
                               this.events.unshift(`[Tick ${this.tickCount}] 🚧 ${bot.player.name} rerouting from crowded ${zone.name} to ${this.map.getZone(validNeighbor.to)?.name}`);
                               bot.targetZoneId = validNeighbor.to;
                               bot.movementProgress = 0; // Reset progress (Walking to neighbor)
                               return;
                           }
                       }
                       // If no accessible neighbor found, stay put (wait at border)
                       // We clamp progress to just before arrival to simulate "blocked"
                       bot.movementProgress = Math.min(bot.movementProgress, distance - 0.1);
                       return;
                   }
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

  private detectEnemies() {
      const activeBots = this.bots.filter(b => b.status === "ALIVE");

      activeBots.forEach(bot => {
          // Check enemies
          const enemies = activeBots.filter(e => e.side !== bot.side);

          enemies.forEach(enemy => {
              let isVisible = false;

              // Case 1: Same Zone
              if (enemy.currentZoneId === bot.currentZoneId) {
                  isVisible = true;
              } else {
                  // Case 2: Connected Zone with Sightline
                  const connections = this.map.getConnections(bot.currentZoneId);
                  const conn = connections.find(c => c.to === enemy.currentZoneId);
                  if (conn && conn.sightline) {
                      // Check Smoke
                      const currentSmoked = (this.zoneStates[bot.currentZoneId]?.smokedUntilTick || 0) > this.tickCount;
                      const targetSmoked = (this.zoneStates[enemy.currentZoneId]?.smokedUntilTick || 0) > this.tickCount;

                      if (!currentSmoked && !targetSmoked) {
                          isVisible = true;
                      }
                  }
              }

              if (isVisible) {
                  // Spot Chance Calculation
                  const base = 0.20;
                  const skill = (bot.player.skills.mental.gameSense + bot.player.skills.mental.positioning) / 400;
                  const noiseLevel = this.zoneStates[enemy.currentZoneId]?.noiseLevel || 0;
                  const noise = Math.min(1, Math.max(0, noiseLevel / 100));
                  const stealth = enemy.isShiftWalking ? 0.15 : 0;

                  const pSpot = Math.max(0, Math.min(1, base + 0.55 * skill + 0.25 * noise - stealth));

                  if (Math.random() < pSpot) {
                      this.eventManager.publish({
                          type: "ENEMY_SPOTTED",
                          zoneId: enemy.currentZoneId,
                          timestamp: this.tickCount,
                          enemyCount: 1,
                          spottedBy: bot.id
                      });
                  }
              }
          });
      });
  }

  private resolveCombat() {
    // 1. Map bots to zones
    const zoneOccupants: Record<string, Bot[]> = {};
    this.bots.forEach(bot => {
      if (bot.status === "DEAD") return;
      if (!zoneOccupants[bot.currentZoneId]) zoneOccupants[bot.currentZoneId] = [];
      zoneOccupants[bot.currentZoneId].push(bot);
    });

    // 2. Determine Intent (Target Selection)
    const engagements: { attacker: Bot; target: Bot; distance: number; isCrossZone: boolean; context: EngagementContext }[] = [];
    const activeBots = this.bots.filter(b => b.status === "ALIVE");

    for (const bot of activeBots) {
        // Eligibility Checks
        if (bot.combatCooldown > 0 || bot.weaponSwapTimer > 0) continue;
        if (bot.aiState === BotAIState.CHARGING_UTILITY) continue;
        if (this.bomb.planterId === bot.id || this.bomb.defuserId === bot.id) continue;

        // Find potential targets
        const potentialTargets: { bot: Bot; distance: number; isCrossZone: boolean; score: number }[] = [];

        // Same Zone
        const sameZoneEnemies = (zoneOccupants[bot.currentZoneId] || [])
            .filter(e => e.side !== bot.side && e.status === "ALIVE");

        sameZoneEnemies.forEach(e => {
            const dist = 100; // Close range
            potentialTargets.push({
                bot: e,
                distance: dist,
                isCrossZone: false,
                score: this.scoreTarget(bot, e, dist, false)
            });
        });

        // Connected Zones (Sightline + Focus Check)
        const canFightCrossZone =
            bot.aiState === BotAIState.HOLDING_ANGLE ||
            bot.aiState === BotAIState.WAITING_FOR_SPLIT ||
            bot.aiState === BotAIState.DEFUSING ||
            (bot.targetZoneId !== null); // Moving = Peeking

        if (canFightCrossZone) {
            const connections = this.map.getConnections(bot.currentZoneId);
            connections.forEach(conn => {
                if (!conn.sightline) return; // No LOS

                // Focus Check
                if (bot.focusZoneId !== conn.to) return;

                const enemies = (zoneOccupants[conn.to] || [])
                     .filter(e => e.side !== bot.side && e.status === "ALIVE");

                if (enemies.length > 0) {
                     const dist = this.map.getDistance(bot.currentZoneId, conn.to);
                     enemies.forEach(e => {
                         potentialTargets.push({
                             bot: e,
                             distance: dist,
                             isCrossZone: true,
                             score: this.scoreTarget(bot, e, dist, true)
                         });
                     });
                }
            });
        }

        if (potentialTargets.length === 0) continue;

        // Weighted Selection
        potentialTargets.sort((a, b) => b.score - a.score);
        const chosen = potentialTargets[0];

        // Build Context
        const attackerZone = this.map.getZone(bot.currentZoneId);
        const targetZone = this.map.getZone(chosen.bot.currentZoneId);

        let peekType: PeekType = "HOLD";
        // Check HOLDING state FIRST (priority over movement)
        if (bot.aiState === BotAIState.HOLDING_ANGLE) {
            peekType = "HOLD";
        } else if (bot.targetZoneId || bot.movementProgress > 0) {
            // Moving/Peeking
            const aggression = bot.player.skills.mental.aggression;
            if (aggression > 150) peekType = "WIDE";
            else if (aggression < 100) peekType = "JIGGLE";
            else peekType = "SWING";
        }

        // Smoked Check
        const currentSmoked = (this.zoneStates[bot.currentZoneId]?.smokedUntilTick || 0) > this.tickCount;
        const targetSmoked = (this.zoneStates[chosen.bot.currentZoneId]?.smokedUntilTick || 0) > this.tickCount;
        const isSmoked = chosen.isCrossZone && (currentSmoked || targetSmoked);

        if (isSmoked) continue; // Skip engagement

        engagements.push({
            attacker: bot,
            target: chosen.bot,
            distance: chosen.distance,
            isCrossZone: chosen.isCrossZone,
            context: {
                isCrossZone: chosen.isCrossZone,
                peekType: peekType,
                // FIX: Only mark as defenderHolding if target is ACTUALLY holding and attacker is NOT
                defenderHolding: chosen.bot.aiState === BotAIState.HOLDING_ANGLE && peekType !== "HOLD",
                attackerCover: attackerZone?.cover || 0,
                defenderCover: targetZone?.cover || 0,
                flashedAttacker: Math.min(1, bot.stunTimer / 20),
                flashedDefender: Math.min(1, chosen.bot.stunTimer / 20),
                smoked: isSmoked
            }
        });
    }

    // 3. Resolve Engagements (Initiative Logic)
    const spentBots = new Set<string>();

    // CRITICAL FIX: Process PEEKERS FIRST
    // We want the Peeker to be the 'Attacker' and Holder to be 'Target'
    // This ensures DuelEngine correctly identifies 'defenderHolding' on the Target.
    engagements.sort((a, b) => {
        const aHolding = a.attacker.aiState === BotAIState.HOLDING_ANGLE ? 1 : 0;
        const bHolding = b.attacker.aiState === BotAIState.HOLDING_ANGLE ? 1 : 0;

        // If both holding or both moving, use original randomization for that subset
        if (aHolding === bHolding) {
            return Math.random() - 0.5;
        }

        // Peekers (0) process before Holders (1)
        return aHolding - bHolding;
    });

    for (const eng of engagements) {
         if (spentBots.has(eng.attacker.id)) continue; // Attacker already fought

         const targetBusy = spentBots.has(eng.target.id);

         // Initiative Calculation
         const returnEng = engagements.find(e => e.attacker.id === eng.target.id && e.target.id === eng.attacker.id);

         let targetCanFire = false;

         if (!targetBusy) {
             if (returnEng) {
                 // Mutual engagement
                 targetCanFire = true;
                 spentBots.add(eng.target.id);
             } else {
                 // Initiative check
                 const initScore = this.calculateInitiative(eng.attacker, eng.target, true); // Attacker is initiating
                 if (initScore < 50) { // Threshold for surprise
                      targetCanFire = true;
                      spentBots.add(eng.target.id);
                 }
             }
         }

         spentBots.add(eng.attacker.id);

         const result = DuelEngine.calculateOutcome(eng.attacker, eng.target, eng.distance, eng.isCrossZone, targetCanFire, eng.context);

        // ADD DEBUG:
        if (process.env.NODE_ENV === 'development') {
            console.log(`
            Engagement: ${eng.attacker.player.name} vs ${eng.target.player.name}
            Attacker State: ${eng.attacker.aiState}
            Target State: ${eng.target.aiState}
            PeekType: ${eng.context.peekType}
            DefenderHolding: ${eng.context.defenderHolding}
            Attacker Time: ${result.initiator.timeTaken}ms
            Target Time: ${result.target.timeTaken}ms
            Winner: ${result.winnerId}
            `);
        }

         // Note: ENEMY_SPOTTED is now handled by detectEnemies().
         // However, gunfire definitely reveals position instantly and reliably.
         // We can keep a high-reliability spot here or rely on Noise + detectEnemies?
         // User: "don't auto-spot after shots... spotting happens from vision + noise"
         // But gunfire increases noise which increases spot chance.
         // However, current detectEnemies runs BEFORE noise is added from combat this tick.
         // So noise from THIS shot affects NEXT tick. That's fine.
         // But "gunfire makes spotting easier" is in the requirement.
         // I will REMOVE the auto-publish here as requested.

        // Interrupt logic
        if (this.bomb.planterId === eng.target.id) { this.bomb.abortPlanting(); eng.target.aiState = BotAIState.DEFAULT; }
        if (this.bomb.defuserId === eng.target.id) { this.bomb.abortDefusing(); eng.target.aiState = BotAIState.DEFAULT; }
        if (eng.target.aiState === BotAIState.CHARGING_UTILITY) { eng.target.aiState = BotAIState.DEFAULT; eng.target.isChargingUtility = false; eng.target.utilityChargeTimer = 0; }

        if (this.zoneStates[eng.attacker.currentZoneId]) {
            this.zoneStates[eng.attacker.currentZoneId].noiseLevel += 50;
        }

         this.applyDuelResult(result);

         // Location string for logging
         const currentZone = this.map.getZone(eng.attacker.currentZoneId);
        const locationStr = eng.isCrossZone
            ? `${currentZone?.name} -> ${this.map.getZone(eng.target.currentZoneId)?.name}`
            : currentZone?.name;

        this.events.unshift(`[Tick ${this.tickCount}] ⚔️ ${eng.attacker.player.name} vs ${eng.target.player.name} (${locationStr})`);
    }
  }

  // Helpers
  private scoreTarget(attacker: Bot, target: Bot, distance: number, isCrossZone: boolean): number {
      let s = 0;
      if (!isCrossZone) s += 30; // Prefer close
      s += Math.max(0, 400 - distance) * 0.1; // Distance factor
      if (target.hasBomb) s += 25;
      if (this.bomb.planterId === target.id) s += 40;
      if (this.bomb.defuserId === target.id) s += 40;
      if (target.hp < 40) s += 15;

      const aggression = attacker.player.skills.mental.aggression;
      s *= 0.7 + (aggression / 150); // Aggression scaling

      return s;
  }

  private calculateInitiative(a: Bot, b: Bot, isPeekerA: boolean): number {
      const ar = a.player.skills.physical.reactionTime;
      const br = b.player.skills.physical.reactionTime;
      const ap = a.player.skills.technical.crosshairPlacement;
      const bp = b.player.skills.technical.crosshairPlacement;

      let aScore = ar + ap * 0.6;
      const bScore = br + bp * 0.6;

      if (isPeekerA) aScore += 10;

      return aScore - bScore;
  }

  private applyDuelResult(result: DuelResult) {
      const initiator = this.bots.find(b => b.id === result.initiator.id);
      const target = this.bots.find(b => b.id === result.target.id);
      if (!initiator || !target) return;

      const events: {time: number, actor: Bot, victim: Bot, damage: number, result: ParticipantResult}[] = [];

      if (result.initiator.fired) {
          events.push({
              time: result.initiator.timeTaken,
              actor: initiator,
              victim: target,
              damage: result.initiator.damage,
              result: result.initiator
          });
      }
      if (result.target.fired) {
           events.push({
              time: result.target.timeTaken,
              actor: target,
              victim: initiator,
              damage: result.target.damage,
              result: result.target
           });
      }

      // Sort by time
      events.sort((a, b) => a.time - b.time);

      for (const e of events) {
          if (e.actor.status === "DEAD") continue; // Actor died before shooting

          if (e.damage > 0) {
              const wasAlive = e.victim.status === "ALIVE";
              e.victim.takeDamage(e.damage);
              this.stats[e.actor.id].damageDealt += e.damage;
              this.stats[e.actor.id].expectedKills += DuelEngine.getWinProbability(e.actor, e.victim, this.map.getDistance(e.actor.currentZoneId, e.victim.currentZoneId), 10).initiatorWinRate; // Approximation

              if (e.victim.hp <= 0 && wasAlive) {
                   this.handleKill(e.actor, e.victim, e.result.isHeadshot, e.actor.getEquippedWeapon());
              }
          }
      }

      if (result.publicLog.length > 0) {
           result.publicLog.forEach(l => this.events.unshift(`> ${l}`));
      }
  }

  private handleKill(killer: Bot, victim: Bot, isHeadshot: boolean, weapon: Weapon | undefined) {
      const weaponName = weapon ? weapon.name : "Unknown";

      // Update Victim Status (takeDamage does it, but ensure consistency)
      victim.status = "DEAD";
      this.stats[killer.id].kills++;
      this.stats[killer.id].actualKills++;
      this.stats[victim.id].deaths++;
      this.roundKills++;

      // Drop Weapon
      if (victim.player.inventory) {
           const zone = this.map.getZone(victim.currentZoneId);
           const dropId = `drop_${this.tickCount}_${victim.id}`;
           const droppedWeapon: DroppedWeapon = {
                id: dropId,
                weaponId: victim.player.inventory.primaryWeapon || victim.player.inventory.secondaryWeapon || "",
                zoneId: victim.currentZoneId,
                x: (zone?.x || 500) + (Math.random() * 40 - 20),
                y: (zone?.y || 500) + (Math.random() * 40 - 20)
           };

           if (victim.player.inventory.primaryWeapon) {
                droppedWeapon.weaponId = victim.player.inventory.primaryWeapon;
                victim.player.inventory.primaryWeapon = undefined;
           } else if (victim.player.inventory.secondaryWeapon) {
                droppedWeapon.weaponId = victim.player.inventory.secondaryWeapon;
                victim.player.inventory.secondaryWeapon = undefined;
           }

           if (droppedWeapon.weaponId) {
                this.zoneStates[victim.currentZoneId].droppedWeapons.push(droppedWeapon);
           }
      }

      // Reward
      let reward = 300;
      if (weapon) {
           reward = EconomySystem.getKillReward(weapon);
      }
      if (killer.player.inventory) {
           killer.player.inventory.money = Math.min(ECONOMY.MAX_MONEY, killer.player.inventory.money + reward);
      }

      this.events.unshift(`💀 [${weaponName}] ${victim.player.name} eliminated by ${killer.player.name} (+$${reward})`);

      // Teammate Died Event
      this.eventManager.publish({
           type: "TEAMMATE_DIED",
           zoneId: victim.currentZoneId,
           timestamp: this.tickCount,
           victimId: victim.id,
           killerId: killer.id
      });

      // Trade Opportunity Check
      const teammates = this.bots.filter(b => b.side === victim.side && b.id !== victim.id && b.status === "ALIVE");

      for (const teammate of teammates) {
          if (teammate.stunTimer > 0) continue;
          if (teammate.combatCooldown > 0) continue;

          let canTrade = false;
          let distance = Infinity;
          let isCrossZone = false;

          if (teammate.currentZoneId === victim.currentZoneId) {
              canTrade = true;
              distance = 100;
              isCrossZone = false;
          } else {
              const connections = this.map.getConnections(teammate.currentZoneId);
              const conn = connections.find(c => c.to === killer.currentZoneId);
              if (conn && conn.sightline) {
                   if (teammate.focusZoneId === killer.currentZoneId) {
                       canTrade = true;
                       distance = this.map.getDistance(teammate.currentZoneId, killer.currentZoneId);
                       isCrossZone = true;
                   }
              }
          }

          if (canTrade) {
              const comms = teammate.player.skills.mental.communication;
              const gameSense = teammate.player.skills.mental.gameSense;
              const tradeDelayTicks = Math.round(Math.max(0, (120 - (comms + gameSense)/2) / 30));

              if (tradeDelayTicks <= 1) {
                   const traderZone = this.map.getZone(teammate.currentZoneId);
                   const killerZone = this.map.getZone(killer.currentZoneId);

                   const context: EngagementContext = {
                       isCrossZone,
                       peekType: "SWING",
                       defenderHolding: false,
                       attackerCover: traderZone?.cover || 0,
                       defenderCover: killerZone?.cover || 0,
                       flashedAttacker: 0,
                       flashedDefender: 0,
                       smoked: false
                   };

                   this.events.unshift(`[Trade] ⚔️ ${teammate.player.name} attempting trade on ${killer.player.name}!`);

                   const result = DuelEngine.calculateOutcome(teammate, killer, distance, isCrossZone, true, context);
                   this.applyDuelResult(result);
                   break; // Only one trade per kill
              }
          }
      }

      // Combat Delay
      const rxn = killer.player.skills.physical.reactionTime;
      const dex = killer.player.skills.physical.dexterity;
      const delay = Math.max(2, Math.floor(6 - (rxn + dex) / 50));
      killer.combatCooldown = delay;

      if (this.bomb.carrierId === victim.id) {
           victim.hasBomb = false;
           this.bomb.drop(victim.currentZoneId);
           this.events.unshift(`⚠️ Bomb dropped at ${this.map.getZone(victim.currentZoneId)?.name}!`);
      }
      if (this.bomb.defuserId === victim.id) this.bomb.abortDefusing();
      if (this.bomb.planterId === victim.id) this.bomb.abortPlanting();
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

  private evaluateTacticTransition() {
      const tTactic = this.tacticsManager.getTactic(TeamSide.T);
      const tAlive = this.bots.filter(b => b.side === TeamSide.T && b.status === "ALIVE").length;
      const ctAlive = this.bots.filter(b => b.side === TeamSide.CT && b.status === "ALIVE").length;

      if (tAlive === 0) return; // No T's alive, don't bother

      // Calculate urgency score (0-100)
      let urgencyScore = 0;

      // 1. TIME PRESSURE (0-40 points)
      if (this.roundTimer <= 25) {
          urgencyScore += 40; // CRITICAL - must execute immediately
      } else if (this.roundTimer <= 40) {
          urgencyScore += 30; // Very urgent
      } else if (this.roundTimer <= 60) {
          urgencyScore += 15; // Starting to be urgent
      }

      // 2. PLAYER DISADVANTAGE (0-30 points)
      if (tAlive < ctAlive) {
          urgencyScore += Math.min(30, (ctAlive - tAlive) * 10);
      }

      // 3. POSITION STALL DETECTION (0-30 points)
      const botsInMid = this.bots.filter(b =>
          b.side === TeamSide.T &&
          b.status === "ALIVE" &&
          (b.currentZoneId.includes("mid") ||
           b.currentZoneId.includes("catwalk") ||
           b.currentZoneId === "top_mid")
      ).length;

      // If majority of team stuck in mid with time running
      if (this.roundTimer < 80 && botsInMid >= Math.ceil(tAlive * 0.6)) {
          urgencyScore += 20;
      }

      // Track progress
      const avgProgress = this.calculateTeamProgress(TeamSide.T);
      if (Math.abs(avgProgress - this.roundStateMetrics.tLastProgressed) < 3) {
          this.roundStateMetrics.tStuckCounter++;

          // Stuck for 5+ seconds (50 ticks)
          if (this.roundStateMetrics.tStuckCounter > 50 && this.roundTimer < 70) {
              urgencyScore += 25;
          }
      } else {
          this.roundStateMetrics.tStuckCounter = 0;
          this.roundStateMetrics.tLastProgressed = avgProgress;
      }

      // ===== DECISION MAKING =====

      // DEFAULT TACTIC EVALUATION
      if (tTactic === "DEFAULT") {
          const criticalUrgency = 50;
          const moderateUrgency = 25;

          if (urgencyScore >= criticalUrgency) {
              // EMERGENCY EXECUTE - pick weakest site
              const newTactic = this.chooseOptimalExecuteSite();
              this.tacticsManager.setTactic(TeamSide.T, newTactic);
              this.tacticsManager.setStage(TeamSide.T, "EXECUTE");
              this.tacticsManager.updateAssignments(this.bots, this.map);
              this.events.unshift(`[TACTICS] 🚨 CRITICAL TIME PRESSURE! Emergency ${newTactic.replace("_", " ")}!`);
              this.roundStateMetrics.lastTacticChange = this.tickCount;
          }
          else if (urgencyScore >= moderateUrgency || this.roundKills > 0) {
              // Standard transition with some intelligence
              const newTactic = this.chooseOptimalExecuteSite();
              this.tacticsManager.setTactic(TeamSide.T, newTactic);
              this.tacticsManager.updateAssignments(this.bots, this.map);
              this.events.unshift(`[Tactics] ⏱️ Executing ${newTactic.replace("_", " ")} (Urgency: ${urgencyScore.toFixed(0)})`);
              this.roundStateMetrics.lastTacticChange = this.tickCount;
          }
      }

      // EXECUTE TACTIC - CHECK FOR STALL & ROTATION
      else if ((tTactic === "EXECUTE_A" || tTactic === "EXECUTE_B") && this.roundTimer < 60) {
          const targetSite = tTactic.includes("_A") ? this.map.data.bombSites.A : this.map.data.bombSites.B;

          // Check progress toward site
          const botsAtSite = this.bots.filter(b =>
              b.side === TeamSide.T &&
              b.status === "ALIVE" &&
              b.currentZoneId === targetSite
          ).length;

          const botsNearSite = this.bots.filter(b =>
              b.side === TeamSide.T &&
              b.status === "ALIVE" &&
              this.isApproachingTarget(b.currentZoneId, targetSite)
          ).length;

          // Nobody at or near site + time critical + not recently changed
          const ticksSinceChange = this.tickCount - this.roundStateMetrics.lastTacticChange;

          if (botsAtSite === 0 && botsNearSite < 2 && this.roundTimer < 40 && ticksSinceChange > 100) {
              // Execution completely stalled - PIVOT
              const newSite = tTactic.includes("_A") ? "B" : "A";
              const newTactic = `EXECUTE_${newSite}` as Tactic;

              this.tacticsManager.setTactic(TeamSide.T, newTactic);
              this.tacticsManager.updateAssignments(this.bots, this.map);
              this.events.unshift(`[TACTICS] 🔄 ${tTactic.split("_")[1]} COMPLETELY BLOCKED! Emergency rotate to ${newSite}!`);
              this.roundStateMetrics.lastTacticChange = this.tickCount;
              this.roundStateMetrics.tStuckCounter = 0;
          }
      }

      // SPLIT TACTIC - EMERGENCY FALLBACK
      else if (tTactic.includes("SPLIT") && this.roundTimer < 30) {
          // If split hasn't executed by 30 seconds, force standard execute
          const site = tTactic.includes("_A") ? "A" : "B";
          const newTactic = `EXECUTE_${site}` as Tactic;

          this.tacticsManager.setTactic(TeamSide.T, newTactic);
          this.tacticsManager.setStage(TeamSide.T, "EXECUTE");
          this.tacticsManager.updateAssignments(this.bots, this.map);
          this.events.unshift(`[TACTICS] ⚠️ Split timing failed - forcing standard execute ${site}!`);
      }
  }

  private calculateTeamProgress(side: TeamSide): number {
      const bots = this.bots.filter(b => b.side === side && b.status === "ALIVE");
      if (bots.length === 0) return 0;

      const progressMap: Record<string, number> = {
          // T Spawn & Initial
          "t_spawn": 0,
          "outside_tunnels": 10,
          "outside_long": 15,

          // Mid-map positioning
          "upper_tunnels": 25,
          "lower_tunnels": 30,
          "mid_doors": 35,
          "top_mid": 40,
          "catwalk": 45,

          // Approaching sites
          "long_doors": 60,
          "long_a": 75,
          "a_short": 70,
          "a_ramp": 80,
          "b_doors": 55,
          "b_window": 60,
          "b_tunnels": 65,

          // Sites
          "a_site": 100,
          "b_site": 100,

          // CT Side
          "ct_spawn": 0,
          // ... add CT zones if needed
      };

      const totalProgress = bots.reduce((sum, bot) => {
          return sum + (progressMap[bot.currentZoneId] || 30); // Default mid-value
      }, 0);

      return totalProgress / bots.length;
  }

  private chooseOptimalExecuteSite(): Tactic {
      const ctBots = this.bots.filter(b => b.side === TeamSide.CT && b.status === "ALIVE");

      if (ctBots.length === 0) {
          // No CTs alive, pick randomly
          return Math.random() > 0.5 ? "EXECUTE_A" : "EXECUTE_B";
      }

      // Count CTs near each site
      let ctNearA = 0;
      let ctNearB = 0;

      ctBots.forEach(bot => {
          if (this.isDefendingSite(bot.currentZoneId, "A")) {
              ctNearA++;
          } else if (this.isDefendingSite(bot.currentZoneId, "B")) {
              ctNearB++;
          } else {
              // In mid or spawn - count as half for both
              ctNearA += 0.5;
              ctNearB += 0.5;
          }
      });

      // Also factor in bomb position if dropped
      let bombBias = 0;
      if (this.bomb.status === BombStatus.IDLE && this.bomb.droppedLocation) {
          const bombZone = this.bomb.droppedLocation;
          if (this.isApproachingTarget(bombZone, this.map.data.bombSites.A)) {
              bombBias = -1; // Favor A
          } else if (this.isApproachingTarget(bombZone, this.map.data.bombSites.B)) {
              bombBias = 1; // Favor B
          }
      }

      const aScore = ctNearA + bombBias;
      const bScore = ctNearB - bombBias;

      // Attack the weaker site
      if (aScore < bScore - 0.5) {
          this.events.unshift(`[AI Analysis] Detected ${ctNearA.toFixed(1)} CTs on A vs ${ctNearB.toFixed(1)} on B - Executing A`);
          return "EXECUTE_A";
      } else if (bScore < aScore - 0.5) {
          this.events.unshift(`[AI Analysis] Detected ${ctNearA.toFixed(1)} CTs on A vs ${ctNearB.toFixed(1)} on B - Executing B`);
          return "EXECUTE_B";
      } else {
          // Even split, pick randomly
          return Math.random() > 0.5 ? "EXECUTE_A" : "EXECUTE_B";
      }
  }

  private isDefendingSite(zoneId: string, site: "A" | "B"): boolean {
      const defensiveZones = {
          A: [
              "a_site", "a_ramp", "a_short", "long_a", "long_doors",
              "catwalk", "top_mid" // Catwalk/Top can watch A
          ],
          B: [
              "b_site", "b_doors", "b_window", "b_tunnels",
              "mid_doors", "lower_tunnels" // Mid can watch B
          ]
      };

      return defensiveZones[site].includes(zoneId);
  }

  private isApproachingTarget(currentZone: string, targetZone: string): boolean {
      // Simple heuristic - check if zones share part of name or are connected
      if (currentZone === targetZone) return true;

      // Get connections to target
      const path = Pathfinder.findPath(this.map, currentZone, targetZone, false);

      // If path exists and is short (1-2 zones away), consider it approaching
      return path !== null && path.length > 0 && path.length <= 3;
  }
}
