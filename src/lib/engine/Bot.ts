import { Player } from "@/types";
import { TacticsManager, TeamSide } from "./TacticsManager";
import { GameMap } from "./GameMap";
import { Pathfinder } from "./Pathfinder";
import { ECONOMY, WEAPONS } from "./constants";
import { Bomb, BombStatus } from "./Bomb";
import { WeaponManager } from "./WeaponManager";
import { Weapon } from "@/types/Weapon";

export type BotStatus = "ALIVE" | "DEAD";

export interface BotAction {
  type: "MOVE" | "HOLD" | "IDLE" | "PLANT" | "DEFUSE" | "CHARGE_UTILITY";
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
  public currentZoneId: string;
  public path: string[];
  public hasBomb: boolean = false;

  // Movement State
  public movementProgress: number = 0;
  public targetZoneId: string | null = null;
  public recoilBulletIndex: number = 0;

  // AI State
  public aiState: BotAIState = BotAIState.DEFAULT;
  public goalZoneId: string | null = null;
  public reactionTimer: number = 0; // Ticks to wait before acting on new goal

  // Behavior State
  public isShiftWalking: boolean = false;
  public isChargingUtility: boolean = false;
  public utilityChargeTimer: number = 0;
  public stealthMode: boolean = false;
  public splitGroup: string | null = null; // "Short", "Long", etc.

  get hp(): number {
    return this.player.health ?? 100;
  }
  set hp(value: number) {
    this.player.health = value;
  }

  get hasHelmet(): boolean {
    return this.player.hasHelmet ?? (this.player.inventory?.hasHelmet ?? false);
  }

  get hasVest(): boolean {
    return this.player.hasVest ?? (this.player.inventory?.hasKevlar ?? false);
  }

  constructor(player: Player, side: TeamSide, startZoneId: string) {
    this.id = player.id;
    this.player = player;
    this.side = side;

    // Initialize Health/Armor state
    if (this.player.health === undefined) this.player.health = 100;

    this.status = "ALIVE";
    this.currentZoneId = startZoneId;
    this.path = [];

    // Initialize Inventory if not present
    if (!this.player.inventory) {
      this.player.inventory = {
        money: ECONOMY.START_MONEY,
        hasKevlar: false,
        hasHelmet: false,
        hasKit: false,
        utilities: []
      };
    }

    // Ensure default pistol
    if (!this.player.inventory.secondaryWeapon) {
      this.player.inventory.secondaryWeapon = side === TeamSide.T ? "glock-18" : "usp-s";
    }
  }

  getEquippedWeapon(): Weapon | undefined {
    // Check primary first
    if (this.player.inventory?.primaryWeapon) {
      const weaponId = this.player.inventory.primaryWeapon;
      const weaponConst = WEAPONS[weaponId];
      if (weaponConst) {
        return WeaponManager.getWeapon(weaponConst.name);
      }
    }

    // Check secondary
    if (this.player.inventory?.secondaryWeapon) {
      const weaponId = this.player.inventory.secondaryWeapon;
      const weaponConst = WEAPONS[weaponId];
      if (weaponConst) {
        return WeaponManager.getWeapon(weaponConst.name);
      }
    }

    return undefined;
  }

  getEffectiveSpeed(baseSpeed: number): number {
      const weapon = this.getEquippedWeapon();
      const mobility = weapon ? weapon.mobility : 250;
      let speed = baseSpeed * (mobility / 250);

      if (this.isShiftWalking) {
          speed *= 0.6;
      }
      return speed;
  }

  makeNoise(): number {
      if (this.targetZoneId && !this.isShiftWalking) {
          return 10;
      }
      return 0;
  }

  updateGoal(map: GameMap, bomb: Bomb, tacticsManager: TacticsManager, zoneStates: Record<string, { noiseLevel: number }>) {
    if (this.status === "DEAD") return;

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

    // Identify current tactic
    const tactic = tacticsManager.getTactic(this.side);

    // Stealth / Shift Walk Logic
    if (tactic.includes("CONTACT")) {
        // Assume stealth unless compromised.
        // Logic to unset stealthMode would be external (MatchSimulator sees enemy -> unsets)
        // For now, enforce it if true.
        if (this.stealthMode) this.isShiftWalking = true;
    } else {
        this.stealthMode = false;
        this.isShiftWalking = false;
    }

    // Execute Charge Logic
    if (tactic.includes("EXECUTE") && !this.isChargingUtility && this.aiState !== BotAIState.CHARGING_UTILITY && this.side === TeamSide.T) {
         if (this.goalZoneId && (this.goalZoneId === map.data.bombSites.A || this.goalZoneId === map.data.bombSites.B)) {
             const zone = map.getZone(this.currentZoneId);
             if (zone && zone.connections.includes(this.goalZoneId)) {
                 // At entry zone, charging utility
                 const utilitySkill = this.player.skills.technical.utility;
                 const chargeTimeMs = 3000 - (utilitySkill * 10);
                 this.utilityChargeTimer = Math.max(1, Math.ceil(chargeTimeMs / 500));
                 this.isChargingUtility = true;
                 this.aiState = BotAIState.CHARGING_UTILITY;
                 return;
             }
         }
    }

    let desiredGoal: string | null = null;
    let desiredState = BotAIState.DEFAULT;

    // --- CT LOGIC ---
    if (this.side === TeamSide.CT) {
      if (bomb.status === BombStatus.PLANTED && bomb.timer < 14 && !bomb.defuserId) {
         desiredState = BotAIState.SAVING;
         desiredGoal = Pathfinder.findFurthestZone(map, bomb.plantSite || this.currentZoneId);
      }
      else if (bomb.status === BombStatus.PLANTED) {
         desiredState = BotAIState.DEFUSING;
         desiredGoal = bomb.plantSite || null;
         if (this.currentZoneId === desiredGoal) {
             if (!bomb.defuserId || bomb.defuserId === this.id) {
                 // Defuse
             } else {
                 desiredState = BotAIState.DEFAULT;
             }
         }
      }
      else {
         desiredState = BotAIState.DEFAULT;
         desiredGoal = tacticsManager.getGoalZone(this, map);

         // CT Rotation Logic based on Noise
         if (this.player.skills.mental.gameSense > 70 && this.aiState === BotAIState.DEFAULT) {
            // Simple heuristic: If total noise in Site A > 50, and I am at B, rotate.
            // We need to know which zones belong to A or B.
            // Simplified: distance check?
            // If I am closer to B, check A noise.
            const distToA = Pathfinder.findPath(map, this.currentZoneId, map.data.bombSites.A)?.length || 99;
            const distToB = Pathfinder.findPath(map, this.currentZoneId, map.data.bombSites.B)?.length || 99;

            let targetSiteNoise = 0;
            let otherSite = "";

            // If closer to B, check A
            if (distToB < distToA) {
                const aZones = ["long_doors", "a_ramp", "a_site", "a_short"]; // Heuristic list
                aZones.forEach(z => targetSiteNoise += (zoneStates[z]?.noiseLevel || 0));
                otherSite = map.data.bombSites.A;
            } else {
                const bZones = ["upper_tunnels", "b_tunnels", "b_site", "mid_doors"];
                bZones.forEach(z => targetSiteNoise += (zoneStates[z]?.noiseLevel || 0));
                otherSite = map.data.bombSites.B;
            }

            if (targetSiteNoise > 40) { // Threshold
                 // Force rotate?
                 // But TacticsManager controls goal.
                 // We can't override assignment permanently.
                 // We can temporarily set goal?
                 // But updateGoal runs every tick.
                 // We need TacticsManager to support "Rotation".
                 // Or just override desiredGoal locally here.
                 desiredGoal = otherSite;
                 desiredState = BotAIState.ROTATING;
            }
         }
      }
    }
    // --- T LOGIC ---
    else {
      if (this.hasBomb) {
          const sites = map.data.bombSites;
          desiredGoal = tacticsManager.getGoalZone(this, map);
          if (this.currentZoneId === sites.A || this.currentZoneId === sites.B) {
              desiredState = BotAIState.PLANTING;
          } else {
              desiredState = BotAIState.DEFAULT;
          }
      }
      else if (bomb.status === BombStatus.PLANTED) {
          desiredState = BotAIState.DEFAULT;
          desiredGoal = bomb.plantSite || this.currentZoneId;
      }
      else {
          desiredState = BotAIState.DEFAULT;
          desiredGoal = tacticsManager.getGoalZone(this, map);
      }
    }

    if (desiredGoal && desiredGoal !== this.goalZoneId) {
        const gameSense = this.player.skills.mental.gameSense;
        const delay = Math.max(0, Math.floor((100 - gameSense) / 20));

        if (this.side === TeamSide.CT && bomb.status !== BombStatus.PLANTED) {
             this.reactionTimer = delay;
        } else {
             this.reactionTimer = 0;
        }

        this.goalZoneId = desiredGoal;
        this.aiState = desiredState;

        const newPath = Pathfinder.findPath(map, this.currentZoneId, this.goalZoneId);
        if (newPath) {
             if (newPath[0] === this.currentZoneId) newPath.shift();
             this.path = newPath;
        } else {
            this.path = [];
        }
    } else if (desiredState !== this.aiState) {
        this.aiState = desiredState;
    }

    if (this.goalZoneId && this.currentZoneId !== this.goalZoneId && this.path.length === 0) {
        const newPath = Pathfinder.findPath(map, this.currentZoneId, this.goalZoneId);
        if (newPath) {
             if (newPath[0] === this.currentZoneId) newPath.shift();
             this.path = newPath;
        }
    }
  }

  decideAction(map: GameMap): BotAction {
    if (this.status === "DEAD") return { type: "IDLE" };

    if (this.aiState === BotAIState.CHARGING_UTILITY) {
        return { type: "CHARGE_UTILITY" };
    }

    if (this.aiState === BotAIState.PLANTING && this.hasBomb) {
         const sites = map.data.bombSites;
         if (this.currentZoneId === sites.A || this.currentZoneId === sites.B) {
             return { type: "PLANT" };
         }
    }

    if (this.aiState === BotAIState.DEFUSING) {
         if (this.goalZoneId && this.currentZoneId === this.goalZoneId) {
             return { type: "DEFUSE" };
         }
    }

    if (this.reactionTimer > 0) {
        return { type: "IDLE" };
    }

    if (this.goalZoneId && this.currentZoneId === this.goalZoneId) {
        return { type: "HOLD" };
    }

    const moveChance = 0.1 + (this.player.skills.mental.aggression / 200) * 0.8;
    const isUrgent = this.aiState === BotAIState.SAVING || this.aiState === BotAIState.DEFUSING || this.aiState === BotAIState.ROTATING;

    if (this.targetZoneId) {
      return { type: "MOVE", targetZoneId: this.targetZoneId };
    }

    if ((isUrgent || Math.random() < moveChance) && this.path.length > 0) {
      return { type: "MOVE", targetZoneId: this.path[0] };
    } else {
      return { type: "HOLD" };
    }
  }

  takeDamage(amount: number) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.status = "DEAD";
    }
  }
}
