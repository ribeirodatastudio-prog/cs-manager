import { Bot, BotAIState } from "./Bot";
import { GameMap } from "./GameMap";
import { Pathfinder } from "./Pathfinder";
import { TacticsManager, TeamSide, Tactic } from "./TacticsManager";
import { DuelEngine, DuelResult } from "./DuelEngine";
import { Player } from "@/types";
import { DUST2_MAP } from "./maps/dust2";
import { MatchState, MatchPhase, RoundEndReason, BuyStrategy, DroppedWeapon, ZoneState } from "./types";
import { EconomySystem } from "./EconomySystem";
import { TeamEconomyManager } from "./TeamEconomyManager";
import { ECONOMY, WEAPONS, WeaponType } from "./constants";
import { DUST2_LOCATIONS, TICK_RATE, TICK_DURATION } from "./cs2Constants";
import { navMeshManager } from "./NavMeshManager";
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

export interface SimulationState {
  bots: Bot[];
  tickCount: number;
  events: string[];
  stats: Record<string, PlayerStats>;
  matchState: MatchState;
  bombState: Bomb;
  roundTimer: number;
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

  public matchState: MatchState;
  public bomb: Bomb;
  public roundTimer: number;
  public zoneStates: Record<string, ZoneState> = {};
  private roundKills: number = 0;
  private bombPlantTick: number = 0;
  private eventManager: EventManager;

  private speedMultiplier: number = 1.0;
  private baseTickRate: number = 50; // 50ms = 20 ticks/sec
  private readonly TICKS_PER_SEC = TICK_RATE; // 20
  private readonly ROUND_TIME = 115;
  private readonly FREEZE_TIME = 5;

  constructor(players: Player[], onUpdate: (state: SimulationState) => void) {
    this.map = new GameMap(DUST2_MAP);
    // Ensure nav mesh is loading
    if (!navMeshManager.isNavMeshLoaded()) {
        navMeshManager.loadNavMesh().catch(e => console.error("Failed to load nav mesh", e));
    }

    this.tacticsManager = new TacticsManager();
    this.tickCount = 0;
    this.isRunning = false;
    this.onUpdate = onUpdate;
    this.events = [];
    this.eventManager = new EventManager();

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

    this.map.data.zones.forEach(z => {
        this.zoneStates[z.id] = { noiseLevel: 0, droppedWeapons: [] };
    });

    this.bots = players.map((p, i) => {
      const side = i % 2 === 0 ? TeamSide.T : TeamSide.CT;
      const spawns = side === TeamSide.CT ? DUST2_LOCATIONS.SPAWNS.CT : DUST2_LOCATIONS.SPAWNS.T;
      const spawnData = spawns[i % spawns.length];
      const startPos = { x: spawnData.x, y: spawnData.y };

      // Determine initial zone
      const zone = this.map.getZoneAt(startPos);
      const startZone = zone ? zone.id : (side === TeamSide.T ? "t_spawn" : "ct_spawn");

      return new Bot(p, side, startPos, startZone, this.eventManager);
    });

    this.bots.forEach(b => {
      this.stats[b.player.id] = { kills: 0, deaths: 0, damageDealt: 0, assists: 0, expectedKills: 0, actualKills: 0 };
    });

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

    this.bots.forEach(b => {
      this.stats[b.player.id] = { kills: 0, deaths: 0, damageDealt: 0, assists: 0, expectedKills: 0, actualKills: 0 };
    });

    this.matchState = {
      round: 1,
      scores: { T: 0, CT: 0 },
      phase: MatchPhase.WARMUP,
      phaseTimer: 0,
      lossBonus: { T: 0, CT: 0 },
      roundHistory: [],
      winThreshold: 13
    };

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
    this.map = new GameMap(JSON.parse(JSON.stringify(DUST2_MAP)));
    this.bomb.reset();
    this.roundTimer = this.ROUND_TIME;
    this.roundKills = 0;
    this.bombPlantTick = 0;
    this.matchState.phase = MatchPhase.PAUSED_FOR_STRATEGY;
    this.matchState.phaseTimer = this.FREEZE_TIME;

    Object.keys(this.zoneStates).forEach(key => {
        this.zoneStates[key].noiseLevel = 0;
        this.zoneStates[key].droppedWeapons = [];
        this.zoneStates[key].smokedUntilTick = 0;
    });

    this.bots.forEach((bot, i) => {
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
      // Reset tactical state
      bot.hasClearedAngles = false;
      bot.currentAngleIndex = 0;
      bot.anglesToClear = [];
      bot.holdPosition = null;
      bot.isHoldingAngle = false;
      bot.holdDuration = 0;
      bot.nextUtilityTarget = null;
      bot.utilityType = null;

      const spawns = bot.side === TeamSide.CT ? DUST2_LOCATIONS.SPAWNS.CT : DUST2_LOCATIONS.SPAWNS.T;
      // Use index i to cycle through spawns, or store individual spawn index
      const spawnData = spawns[i % spawns.length];

      bot.pos = { x: spawnData.x, y: spawnData.y };
      bot.prevPos = { x: spawnData.x, y: spawnData.y };

      const zone = this.map.getZoneAt(bot.pos);
      bot.currentZoneId = zone ? zone.id : (bot.side === TeamSide.T ? "t_spawn" : "ct_spawn");

      if (wasDead) {
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
          if (bot.player.inventory) {
              if (!bot.player.inventory.secondaryWeapon) {
                  bot.player.inventory.secondaryWeapon = bot.side === TeamSide.T ? "glock-18" : "usp-s";
              }
          }
      }
    });

    const ts = this.bots.filter(b => b.side === TeamSide.T);
    if (ts.length > 0) {
        const carrier = ts[Math.floor(Math.random() * ts.length)];
        carrier.hasBomb = true;
        this.bomb.pickup(carrier.id);
        this.events.unshift(`[Round ${this.matchState.round}] 💣 ${carrier.player.name} has the bomb.`);
    }

    this.tacticsManager.updateAssignments(this.bots, this.map);
  }

  public applyStrategies(tStrategy: BuyStrategy, tTactic: Tactic, ctStrategy: BuyStrategy, ctTactic: Tactic, roleOverrides: Record<string, string>, buyOverrides: Record<string, BuyStrategy> = {}) {
    this.tacticsManager.setRoleAssignments(roleOverrides);
    this.tacticsManager.setTactic(TeamSide.T, tTactic);
    this.tacticsManager.setTactic(TeamSide.CT, ctTactic);
    this.tacticsManager.updateAssignments(this.bots, this.map);

    const tBots = this.bots.filter(b => b.side === TeamSide.T);
    const ctBots = this.bots.filter(b => b.side === TeamSide.CT);

    TeamEconomyManager.executeTeamBuy(tBots, tStrategy, TeamSide.T, buyOverrides);
    TeamEconomyManager.executeTeamBuy(ctBots, ctStrategy, TeamSide.CT, buyOverrides);

    this.matchState.phase = MatchPhase.FREEZETIME;
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
    // 1. Timers
    if (this.tickCount % this.TICKS_PER_SEC === 0) {
        if (this.bomb.status === BombStatus.PLANTED || this.bomb.status === BombStatus.DEFUSING) {
             // Timer frozen
        } else {
             this.roundTimer--;
        }
    }

    this.bomb.tick();
    if (this.bomb.status === BombStatus.PLANTED) {
         if (this.tickCount - this.bombPlantTick > (40 * this.TICKS_PER_SEC) + 25) {
             this.bomb.status = BombStatus.DETONATED;
         }
    }

    Object.values(this.zoneStates).forEach(state => {
        state.noiseLevel = Math.max(0, state.noiseLevel - 2);
    });

    this.evaluateTacticTransition();

    // Split Sync Logic (T Side)
    const tTactic = this.tacticsManager.getTactic(TeamSide.T);
    if (tTactic.includes("SPLIT") && this.tacticsManager.getStage(TeamSide.T) === "SETUP") {
        const tBots = this.bots.filter(b => b.side === TeamSide.T && b.status === "ALIVE");
        let allReady = true;
        for (const bot of tBots) {
            const goal = this.tacticsManager.getGoalZone(bot, this.map);
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

    this.detectEnemies();

    // Bomb Recovery
    if (this.bomb.status === BombStatus.IDLE && this.bomb.droppedLocation) {
         const carrier = this.bots.find(b => b.status === "ALIVE" && b.currentZoneId === this.bomb.droppedLocation && b.side === TeamSide.T);
         if (carrier) {
             this.bomb.pickup(carrier.id);
             carrier.hasBomb = true;
             this.events.unshift(`[Round ${this.matchState.round}] 💣 ${carrier.player.name} recovered the bomb!`);
         }
    }

    // 2. Bots Logic & Movement
    this.bots.forEach(bot => {
      if (bot.status === "DEAD") return;

      // Update AI with Tactical Behavior
      bot.updateTacticalBehavior(this.map, this.bots, this.tickCount);
      bot.updateGoal(this.map, this.bomb, this.tacticsManager, this.zoneStates, this.tickCount, this.bots);
      const action = bot.decideAction(this.map, this.zoneStates, this.roundTimer);

      // Utility Logic
      if (bot.isChargingUtility && bot.utilityChargeTimer === 1) {
           const utilType = bot.activeUtility || "flashbang";
           bot.utilityCooldown = 50;
           bot.hasThrownEntryUtility = true;
           this.events.unshift(`[Tick ${this.tickCount}] 🧨 ${bot.player.name} threw ${utilType}`);

           if (utilType === "smoke" && bot.goalZoneId) {
                if (!this.zoneStates[bot.goalZoneId]) this.zoneStates[bot.goalZoneId] = { noiseLevel: 0, droppedWeapons: [] };
                this.zoneStates[bot.goalZoneId].smokedUntilTick = this.tickCount + (18 * this.TICKS_PER_SEC);
           }
      }

      // Add Noise
      const noise = bot.makeNoise();
      if (this.zoneStates[bot.currentZoneId]) {
          this.zoneStates[bot.currentZoneId].noiseLevel += noise;
      }

      // Execute Action
      if (action.type === "PICKUP_WEAPON") {
         const zoneDrops = this.zoneStates[bot.currentZoneId]?.droppedWeapons || [];
         if (zoneDrops.length > 0) {
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

                  if (bot.player.inventory) {
                      if (isPistol) bot.player.inventory.secondaryWeapon = newWeaponId;
                      else bot.player.inventory.primaryWeapon = newWeaponId;
                  }

                  this.zoneStates[bot.currentZoneId].droppedWeapons.splice(bestDropIndex, 1);
                  bot.weaponSwapTimer = 13;
                  this.events.unshift(`[Tick ${this.tickCount}] 🎒 ${bot.player.name} picked up ${WEAPONS[newWeaponId].name}`);
              }
         }
      } else if (action.type === "PLANT") {
          if (this.bomb.status === BombStatus.IDLE) {
              this.bomb.startPlanting(bot.id, bot.currentZoneId);
          }
      } else if (action.type === "DEFUSE") {
          if (this.bomb.status === BombStatus.PLANTED) {
              this.bomb.startDefusing(bot.id);
          }
      }

      if (action.type === "PLANT" || action.type === "DEFUSE") {
          bot.path = [];
      }

      // bot.move(dt, this.map) - Using TICK_DURATION constant
      bot.move(TICK_DURATION, this.map);
    });

    this.resolveCombat();

    // Bomb Progress
    if (this.bomb.status === BombStatus.PLANTING) {
        if (this.bomb.updatePlanting()) {
            this.events.unshift(`[Tick ${this.tickCount}] 💣 BOMB PLANTED!`);
            this.bombPlantTick = this.tickCount;
             const carrier = this.bots.find(b => b.id === this.bomb.planterId);
             if (carrier) carrier.hasBomb = false;
        }
    } else if (this.bomb.status === BombStatus.DEFUSING) {
        const defuser = this.bots.find(b => b.id === this.bomb.defuserId);
        const hasDefuseKit = defuser?.player.inventory?.hasDefuseKit || false;
        if (this.bomb.updateDefusing(hasDefuseKit)) {
             // Defused logic handled in checkWin
        }
    }

    this.checkWinConditions();
  }

  private detectEnemies() {
      const activeBots = this.bots.filter(b => b.status === "ALIVE");

      activeBots.forEach(bot => {
          const enemies = activeBots.filter(e => e.side !== bot.side);
          enemies.forEach(enemy => {
              let isVisible = false;

              // Raycast Vision Check
              if (Pathfinder.hasLineOfSight(bot.pos, enemy.pos)) {
                  const currentSmoked = (this.zoneStates[bot.currentZoneId]?.smokedUntilTick || 0) > this.tickCount;
                  const targetSmoked = (this.zoneStates[enemy.currentZoneId]?.smokedUntilTick || 0) > this.tickCount;

                  if (!currentSmoked && !targetSmoked) {
                      isVisible = true;
                  }
              }

              if (isVisible) {
                  const base = 0.20;
                  const skill = (bot.player.skills.mental.gameSense + bot.player.skills.mental.positioning) / 400;
                  const noiseLevel = this.zoneStates[enemy.currentZoneId]?.noiseLevel || 0;
                  const noise = Math.min(1, Math.max(0, noiseLevel / 100));
                  const stealth = enemy.isShiftWalking ? 0.15 : 0;

                  const pSpot = (Math.max(0, Math.min(1, base + 0.55 * skill + 0.25 * noise - stealth))) * 0.4;

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
    const spentBots = new Set<string>();
    const engagements: { attacker: Bot; target: Bot; distance: number; context: EngagementContext }[] = [];
    const activeBots = this.bots.filter(b => b.status === "ALIVE");

    for (const bot of activeBots) {
        if (bot.combatCooldown > 0 || bot.weaponSwapTimer > 0) continue;
        if (this.bomb.planterId === bot.id || this.bomb.defuserId === bot.id) continue;

        const enemies = activeBots.filter(e => e.side !== bot.side);
        const visibleEnemies = enemies.filter(e => {
            if (!Pathfinder.hasLineOfSight(bot.pos, e.pos)) return false;
            const s1 = (this.zoneStates[bot.currentZoneId]?.smokedUntilTick || 0) > this.tickCount;
            const s2 = (this.zoneStates[e.currentZoneId]?.smokedUntilTick || 0) > this.tickCount;
            return !s1 && !s2;
        });

        if (visibleEnemies.length === 0) continue;

        const scored = visibleEnemies.map(e => ({
            bot: e,
            distance: this.map.getPointDistance(bot.pos, e.pos),
            score: this.scoreTarget(bot, e)
        })).sort((a, b) => b.score - a.score);

        const chosen = scored[0];
        const attackerZone = this.map.getZone(bot.currentZoneId);
        const targetZone = this.map.getZone(chosen.bot.currentZoneId);

        let peekType: PeekType = "HOLD";
        if (bot.aiState === BotAIState.HOLDING_ANGLE) peekType = "HOLD";
        else if (bot.path.length > 0) {
             const agg = bot.player.skills.mental.aggression;
             if (agg > 150) peekType = "WIDE";
             else peekType = "JIGGLE";
        }

        const isExpected = (chosen.bot.internalThreatMap[bot.currentZoneId]?.level || 0) > 0;

        engagements.push({
            attacker: bot,
            target: chosen.bot,
            distance: chosen.distance,
            context: {
                isCrossZone: bot.currentZoneId !== chosen.bot.currentZoneId,
                peekType,
                defenderHolding: chosen.bot.aiState === BotAIState.HOLDING_ANGLE,
                attackerCover: attackerZone?.cover || 0,
                defenderCover: targetZone?.cover || 0,
                flashedAttacker: Math.min(1, bot.stunTimer / 50),
                flashedDefender: Math.min(1, chosen.bot.stunTimer / 50),
                smoked: false,
                isExpected
            }
        });
    }

    engagements.sort((a, b) => {
        const aHolding = a.attacker.aiState === BotAIState.HOLDING_ANGLE ? 1 : 0;
        const bHolding = b.attacker.aiState === BotAIState.HOLDING_ANGLE ? 1 : 0;
        if (aHolding === bHolding) return Math.random() - 0.5;
        return aHolding - bHolding;
    });

    for (const eng of engagements) {
        if (spentBots.has(eng.attacker.id)) continue;
        const targetBusy = spentBots.has(eng.target.id);

        let targetCanFire = false;
        if (!targetBusy) {
            const reaction = this.calculateInitiative(eng.attacker, eng.target);
            if (reaction < 50) {
                targetCanFire = true;
                spentBots.add(eng.target.id);
            }
        }
        spentBots.add(eng.attacker.id);

        const result = DuelEngine.calculateOutcome(eng.attacker, eng.target, eng.distance, eng.context.isCrossZone, targetCanFire, eng.context);

        this.applyDuelResult(result);
        if (this.zoneStates[eng.attacker.currentZoneId]) this.zoneStates[eng.attacker.currentZoneId].noiseLevel += 20;
        this.events.unshift(`[Tick ${this.tickCount}] ⚔️ ${eng.attacker.player.name} vs ${eng.target.player.name}`);
    }
  }

  private scoreTarget(attacker: Bot, target: Bot): number {
      const dist = this.map.getPointDistance(attacker.pos, target.pos);
      let s = 1000 - dist;
      if (target.hp < 50) s += 200;
      return s;
  }

  private calculateInitiative(a: Bot, b: Bot): number {
      return (a.player.skills.physical.reactionTime) - (b.player.skills.physical.reactionTime);
  }

  private applyDuelResult(result: DuelResult) {
      const initiator = this.bots.find(b => b.id === result.initiator.id);
      const target = this.bots.find(b => b.id === result.target.id);
      if (!initiator || !target) return;

      if (result.initiator.fired) {
          target.takeDamage(result.initiator.damage);
          if (target.hp <= 0) this.handleKill(initiator, target, result.initiator.isHeadshot, initiator.getEquippedWeapon());
      }
      if (result.target.fired && initiator.status === "ALIVE") {
          initiator.takeDamage(result.target.damage);
          if (initiator.hp <= 0) this.handleKill(target, initiator, result.target.isHeadshot, target.getEquippedWeapon());
      }
  }

  private handleKill(killer: Bot, victim: Bot, isHeadshot: boolean, weapon: Weapon | undefined) {
      victim.status = "DEAD";
      this.stats[killer.id].kills++;
      this.stats[victim.id].deaths++;
      this.roundKills++;

      const wName = weapon ? weapon.name : "Unknown";
      this.events.unshift(`💀 [${wName}] ${victim.player.name} eliminated by ${killer.player.name}`);
      this.eventManager.publish({ type: "TEAMMATE_DIED", zoneId: victim.currentZoneId, timestamp: this.tickCount, victimId: victim.id, killerId: killer.id });

      if (this.bomb.carrierId === victim.id) {
          this.bomb.drop(victim.currentZoneId);
          victim.hasBomb = false;
      }
      if (this.bomb.defuserId === victim.id) this.bomb.abortDefusing();
      if (this.bomb.planterId === victim.id) this.bomb.abortPlanting();
  }

  private checkWinConditions() {
      if (this.bomb.status === BombStatus.DETONATED) { this.endRound(TeamSide.T, RoundEndReason.TARGET_BOMBED); return; }
      if (this.bomb.status === BombStatus.DEFUSED) { this.endRound(TeamSide.CT, RoundEndReason.BOMB_DEFUSED); return; }

      const tAlive = this.bots.filter(b => b.side === TeamSide.T && b.status === "ALIVE").length;
      const ctAlive = this.bots.filter(b => b.side === TeamSide.CT && b.status === "ALIVE").length;

      if (tAlive === 0 && this.bomb.status !== BombStatus.PLANTED) this.endRound(TeamSide.CT, RoundEndReason.ELIMINATION_T);
      if (ctAlive === 0) this.endRound(TeamSide.T, RoundEndReason.ELIMINATION_CT);

      if (this.roundTimer <= 0 && this.bomb.status !== BombStatus.PLANTED) this.endRound(TeamSide.CT, RoundEndReason.TIME_RUNNING_OUT);
  }

  private endRound(winner: TeamSide, reason: RoundEndReason) {
      this.stop();
      this.matchState.phase = MatchPhase.ROUND_END;
      this.matchState.scores[winner]++;
      this.events.unshift(`🏆 ${winner} Wins! (${reason})`);
      this.updateEconomy(winner, reason);
      this.matchState.round++;
  }

  private updateEconomy(winner: TeamSide, reason: RoundEndReason) {
      this.bots.forEach(b => {
          if (b.player.inventory) b.player.inventory.money += 3000;
      });
  }

  private broadcast() {
    this.onUpdate({
      bots: this.bots,
      tickCount: this.tickCount,
      events: this.events,
      stats: this.stats,
      matchState: this.matchState,
      bombState: this.bomb,
      roundTimer: this.roundTimer,
      zoneStates: this.zoneStates
    });
  }

  private evaluateTacticTransition() {
      const tTactic = this.tacticsManager.getTactic(TeamSide.T);
      const tAlive = this.bots.filter(b => b.side === TeamSide.T && b.status === "ALIVE").length;
      const ctAlive = this.bots.filter(b => b.side === TeamSide.CT && b.status === "ALIVE").length;
      if (tAlive === 0) return;

      let urgencyScore = 0;
      if (this.roundTimer <= 25) urgencyScore += 40;
      else if (this.roundTimer <= 40) urgencyScore += 30;
      else if (this.roundTimer <= 60) urgencyScore += 25;

      if (tAlive < ctAlive) urgencyScore += Math.min(30, (ctAlive - tAlive) * 10);

      const botsInMid = this.bots.filter(b => b.side === TeamSide.T && b.status === "ALIVE" && ["xbox", "suicide", "top_mid"].includes(b.currentZoneId)).length;
      if (this.roundTimer < 80 && botsInMid >= Math.ceil(tAlive * 0.6)) urgencyScore += 20;

      const avgProgress = this.calculateTeamProgress(TeamSide.T);
      if (Math.abs(avgProgress - this.roundStateMetrics.tLastProgressed) < 3) {
          this.roundStateMetrics.tStuckCounter++;
          if (this.roundStateMetrics.tStuckCounter > 50 && this.roundTimer < 70) urgencyScore += 25;
      } else {
          this.roundStateMetrics.tStuckCounter = 0;
          this.roundStateMetrics.tLastProgressed = avgProgress;
      }

      if (tTactic === "DEFAULT") {
          if (urgencyScore >= 25) {
              const newTactic = this.chooseOptimalExecuteSite();
              this.tacticsManager.setTactic(TeamSide.T, newTactic);
              this.tacticsManager.updateAssignments(this.bots, this.map);
              this.events.unshift(`[Tactics] ⏱️ Executing ${newTactic} (Urgency: ${urgencyScore})`);
          }
      }
  }

  private calculateTeamProgress(side: TeamSide): number {
      const bots = this.bots.filter(b => b.side === side && b.status === "ALIVE");
      if (bots.length === 0) return 0;
      return 50;
  }

  private chooseOptimalExecuteSite(): Tactic {
      return Math.random() > 0.5 ? "EXECUTE_A" : "EXECUTE_B";
  }
}
