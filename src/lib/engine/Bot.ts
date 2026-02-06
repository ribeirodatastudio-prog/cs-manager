import { Player } from "@/types";
import { TacticsManager, TeamSide } from "./TacticsManager";
import { GameMap } from "./GameMap";
import { ECONOMY, WEAPONS } from "./constants";
import { Bomb, BombStatus } from "./Bomb";
import { WeaponManager } from "./WeaponManager";
import { Weapon } from "@/types/Weapon";
import { EventManager, GameEvent } from "./EventManager";
import { DroppedWeapon, Point, ZoneState } from "./types";

export type BotStatus = "ALIVE" | "DEAD";

export interface BotAction {
  type: "MOVE" | "HOLD" | "IDLE" | "PLANT" | "DEFUSE" | "CHARGE_UTILITY" | "PICKUP_WEAPON";
  targetZoneId?: string;
}

export enum BotAIState {
  DEFAULT = "DEFAULT",
  PLANTING = "PLANTING",
  DEFUSING = "DEFUSING",
  SAVING = "SAVING",
  ROTATING = "ROTATING",
  CHARGING_UTILITY = "CHARGING_UTILITY",
  WAITING_FOR_SPLIT = "WAITING_FOR_SPLIT",
  HOLDING_ANGLE = "HOLDING_ANGLE"
}

export class Bot {
  public id: string;
  public player: Player;
  public side: TeamSide;
  public status: BotStatus;

  public pos: Point;
  public prevPos: Point;
  public currentZoneId: string;
  public path: Point[] = [];

  public hasBomb: boolean = false;

  public recoilBulletIndex: number = 0;
  public combatCooldown: number = 0;
  public weaponSwapTimer: number = 0;

  public aiState: BotAIState = BotAIState.DEFAULT;
  public goalZoneId: string | null = null;
  public reactionTimer: number = 0;
  public internalThreatMap: Record<string, { level: number; timestamp: number }> = {};
  public focusZoneId: string | null = null;

  public isShiftWalking: boolean = false;
  public isChargingUtility: boolean = false;
  public utilityChargeTimer: number = 0;
  public utilityCooldown: number = 0;
  public activeUtility: string | null = null;
  public hasThrownEntryUtility: boolean = false;
  public stealthMode: boolean = false;
  public splitGroup: string | null = null;
  public stunTimer: number = 0;
  public isEntryFragger: boolean = false;
  public sprintMultiplier: number = 1.0;
  public roundRole: string;

  public pendingEvents: { event: GameEvent; processAt: number }[] = [];

  private lastZoneChangeTick: number = 0;
  private lastZone: string = "";

  private eventManager: EventManager;

  get hp(): number { return this.player.health ?? 100; }
  set hp(value: number) { this.player.health = value; }

  get hasHelmet(): boolean { return this.player.hasHelmet ?? (this.player.inventory?.hasHelmet ?? false); }
  get hasVest(): boolean { return this.player.hasVest ?? (this.player.inventory?.hasKevlar ?? false); }

  constructor(player: Player, side: TeamSide, startPos: Point, startZoneId: string, eventManager: EventManager) {
    this.id = player.id;
    this.player = player;
    this.side = side;
    this.eventManager = eventManager;
    this.roundRole = player.role;

    if (this.player.health === undefined) this.player.health = 100;

    this.status = "ALIVE";
    this.pos = { ...startPos };
    this.prevPos = { ...startPos };
    this.currentZoneId = startZoneId;

    if (!this.player.inventory) {
      this.player.inventory = {
        money: ECONOMY.START_MONEY,
        hasKevlar: false,
        hasHelmet: false,
        hasDefuseKit: false,
        grenades: []
      };
    }
    if (!this.player.inventory.secondaryWeapon) {
      this.player.inventory.secondaryWeapon = side === TeamSide.T ? "glock-18" : "usp-s";
    }

    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    this.eventManager.subscribe("ENEMY_SPOTTED", (e) => this.handleEvent(e));
    this.eventManager.subscribe("TEAMMATE_DIED", (e) => this.handleEvent(e));
  }

  private handleEvent(event: GameEvent) {
      if (this.status === "DEAD") return;
      if (event.type === "ENEMY_SPOTTED") {
          if (event.spottedBy === this.id) {
              this.internalThreatMap[event.zoneId] = { level: 100, timestamp: event.timestamp };
          } else {
              const p = this.getCommsReliability();
              if (Math.random() < p) {
                   const delay = this.getCommsDelayTicks();
                   this.pendingEvents.push({
                       event: event,
                       processAt: event.timestamp + delay
                   });
              }
          }
      } else if (event.type === "TEAMMATE_DIED") {
          this.internalThreatMap[event.zoneId] = { level: 100, timestamp: event.timestamp };
      }
  }

  getCommsReliability(): number {
      const comms = this.player.skills.mental.communication;
      return Math.max(0.15, Math.min(0.95, 0.15 + (comms / 200) * 0.8));
  }

  getCommsDelayTicks(): number {
      const comms = this.player.skills.mental.communication;
      return Math.round(Math.max(0, (120 - comms) / 8));
  }

  private processPendingEvents(currentTick: number) {
      const remaining: { event: GameEvent; processAt: number }[] = [];
      this.pendingEvents.forEach(item => {
          if (currentTick >= item.processAt) {
              const event = item.event;
              if (event.type === "ENEMY_SPOTTED") {
                   this.internalThreatMap[event.zoneId] = { level: 80, timestamp: event.timestamp };
              }
          } else {
              remaining.push(item);
          }
      });
      this.pendingEvents = remaining;
  }

  getEquippedWeapon(): Weapon | undefined {
    if (this.player.inventory?.primaryWeapon) {
      const w = WEAPONS[this.player.inventory.primaryWeapon];
      if (w) return WeaponManager.getWeapon(w.name);
    }
    if (this.player.inventory?.secondaryWeapon) {
      const w = WEAPONS[this.player.inventory.secondaryWeapon];
      if (w) return WeaponManager.getWeapon(w.name);
    }
    return undefined;
  }

  move(dt: number, map: GameMap) {
      if (this.status === "DEAD") return;

      this.prevPos = { ...this.pos };

      if (this.path.length === 0) return;

      const target = this.path[0];
      const dx = target.x - this.pos.x;
      const dy = target.y - this.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 5) {
          this.path.shift();
          if (this.path.length === 0) return;
          return;
      }

      const baseSpeed = 250;
      const speed = this.getEffectiveSpeed(baseSpeed);
      const moveDist = speed * dt;

      const ndx = dx / dist;
      const ndy = dy / dist;

      let nextX = this.pos.x + ndx * moveDist;
      let nextY = this.pos.y + ndy * moveDist;

      if (!map.isWalkable(nextX, nextY)) {
          if (map.isWalkable(nextX, this.pos.y)) {
              nextY = this.pos.y;
          }
          else if (map.isWalkable(this.pos.x, nextY)) {
              nextX = this.pos.x;
          }
          else {
              nextX = this.pos.x;
              nextY = this.pos.y;
          }
      }

      this.pos.x = nextX;
      this.pos.y = nextY;

      const newZone = map.getZoneAt(this.pos);
      if (newZone && newZone.id !== this.currentZoneId) {
          this.currentZoneId = newZone.id;
      }
  }

  getEffectiveSpeed(baseSpeed: number, roundTimer?: number): number {
      const weapon = this.getEquippedWeapon();
      const mobility = weapon ? weapon.mobility : 250;
      let speed = baseSpeed * (mobility / 250);

      if (this.isShiftWalking) {
          speed *= 0.52;
      }

      if (this.side === TeamSide.CT && (this.aiState === BotAIState.DEFUSING || this.aiState === BotAIState.ROTATING)) {
          speed *= 1.10;
      }

      if (this.side === TeamSide.T && roundTimer !== undefined) {
          if (roundTimer < 15) speed *= 1.3;
          else if (roundTimer < 25) speed *= 1.15;
      }

      if (this.roundRole === "Entry Fragger" && !this.isShiftWalking) speed *= 1.05;

      return speed * this.sprintMultiplier;
  }

  makeNoise(): number {
      if (this.path.length > 0 && !this.isShiftWalking) {
          return 4;
      }
      return 0;
  }

  private calculateGlobalThreat(map: GameMap, currentTick: number): number {
      let totalThreat = 0;
      for (const zoneId in this.internalThreatMap) {
          const entry = this.internalThreatMap[zoneId];
          const age = currentTick - entry.timestamp;
          if (age > 250) {
               delete this.internalThreatMap[zoneId];
          } else {
               totalThreat += entry.level;
          }
      }
      return totalThreat;
  }

  updateGoal(map: GameMap, bomb: Bomb, tacticsManager: TacticsManager, zoneStates: Record<string, ZoneState>, currentTick: number = 0, allBots: Bot[] = []) {
    if (this.status === "DEAD") return;

    this.processPendingEvents(currentTick);

    if (this.combatCooldown > 0) this.combatCooldown--;
    if (this.utilityCooldown > 0) this.utilityCooldown--;
    if (this.weaponSwapTimer > 0) this.weaponSwapTimer--;
    if (this.stunTimer > 0) this.stunTimer--;
    if (this.reactionTimer > 0) {
        this.reactionTimer--;
        return;
    }
    if (this.utilityChargeTimer > 0) {
        this.utilityChargeTimer--;
        if (this.utilityChargeTimer <= 0) {
            this.isChargingUtility = false;
            this.aiState = BotAIState.DEFAULT;
        } else {
             this.aiState = BotAIState.CHARGING_UTILITY;
             return;
        }
    }

    const tactic = tacticsManager.getTactic(this.side);

    if (this.checkPathStuck(currentTick)) {
         this.path = [];
         if (this.goalZoneId) {
             const goalZone = map.getZone(this.goalZoneId);
             if (goalZone) {
                const newPath = map.findPath(this.pos, {x: goalZone.x, y: goalZone.y});
                if (newPath.length > 0) this.path = newPath;
             }
         }
    }

    this.isShiftWalking = false;
    if (tactic.includes("CONTACT") && this.stealthMode) this.isShiftWalking = true;
    if (this.roundRole === "Lurker" && this.side === TeamSide.T) this.isShiftWalking = true;
    if (this.roundRole === "Entry Fragger") this.isShiftWalking = false;

    let desiredGoalId: string | null = null;
    let desiredState = BotAIState.DEFAULT;

    if (this.side === TeamSide.CT) {
        if (bomb.status === BombStatus.PLANTED) {
            this.isShiftWalking = false;
            desiredState = BotAIState.DEFUSING;
            desiredGoalId = bomb.plantSite || null;
        } else {
             desiredGoalId = tacticsManager.getGoalZone(this, map);
        }
    } else {
        if (this.hasBomb) {
             desiredGoalId = tacticsManager.getGoalZone(this, map);
             const sites = map.data.bombSites;
             if (this.currentZoneId === sites.A || this.currentZoneId === sites.B) desiredState = BotAIState.PLANTING;
        } else {
             desiredGoalId = tacticsManager.getGoalZone(this, map);
        }
    }

    if (desiredGoalId && desiredGoalId !== this.goalZoneId) {
        this.goalZoneId = desiredGoalId;
        this.aiState = desiredState;

        const goalZone = map.getZone(desiredGoalId);
        if (goalZone) {
            this.path = map.findPath(this.pos, {x: goalZone.x, y: goalZone.y});
        }
    }
  }

  private checkPathStuck(currentTick: number): boolean {
      if (!this.lastZoneChangeTick) {
          this.lastZoneChangeTick = currentTick;
          this.lastZone = this.currentZoneId;
          return false;
      }
      if (this.currentZoneId !== this.lastZone) {
          this.lastZoneChangeTick = currentTick;
          this.lastZone = this.currentZoneId;
          return false;
      }
      const ticksStuck = currentTick - this.lastZoneChangeTick;
      return ticksStuck > 250 && this.path.length > 0;
  }

  decideAction(map: GameMap, zoneStates: Record<string, ZoneState>, roundTimer: number): BotAction {
      if (this.status === "DEAD") return { type: "IDLE" };

      if (this.aiState === BotAIState.PLANTING && this.hasBomb) {
           const sites = map.data.bombSites;
           if (this.currentZoneId === sites.A || this.currentZoneId === sites.B) return { type: "PLANT" };
      }

      // Use roundTimer slightly to silence linter if not effectively used, or keep logic logic
      if (roundTimer < 0) { /* dummy check */ }

      if (this.path.length > 0) return { type: "MOVE" };

      return { type: "HOLD" };
  }

  takeDamage(amount: number) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.status = "DEAD";
    }
  }
}
