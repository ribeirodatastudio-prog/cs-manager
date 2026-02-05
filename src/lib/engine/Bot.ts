import { Player } from "@/types";
import { TacticsManager, TeamSide } from "./TacticsManager";
import { GameMap } from "./GameMap";
import { Pathfinder } from "./Pathfinder";
import { ECONOMY, WEAPONS } from "./constants";
import { Bomb, BombStatus } from "./Bomb";
import { WeaponManager } from "./WeaponManager";
import { Weapon } from "@/types/Weapon";
import { EventManager, GameEvent } from "./EventManager";

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
  public combatCooldown: number = 0; // Ticks to wait after a kill

  // AI State
  public aiState: BotAIState = BotAIState.DEFAULT;
  public goalZoneId: string | null = null;
  public reactionTimer: number = 0; // Ticks to wait before acting on new goal
  public internalThreatMap: Record<string, { level: number; timestamp: number }> = {};
  public focusZoneId: string | null = null;

  // Behavior State
  public isShiftWalking: boolean = false;
  public isChargingUtility: boolean = false;
  public utilityChargeTimer: number = 0;
  public utilityCooldown: number = 0;
  public activeUtility: string | null = null;
  public hasThrownEntryUtility: boolean = false;
  public stealthMode: boolean = false;
  public splitGroup: string | null = null; // "Short", "Long", etc.
  public stunTimer: number = 0;
  public isEntryFragger: boolean = false;
  public sprintMultiplier: number = 1.0;

  private eventManager: EventManager;

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

  constructor(player: Player, side: TeamSide, startZoneId: string, eventManager: EventManager) {
    this.id = player.id;
    this.player = player;
    this.side = side;
    this.eventManager = eventManager;

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
        hasDefuseKit: false,
        grenades: []
      };
    }

    // Ensure default pistol
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

      // Filter events: Ignore own events if handled elsewhere, but generally bots know what they see.
      // But this event comes from MatchSimulator broadcast.
      if (event.type === "ENEMY_SPOTTED") {
          // If I am the spotter, I already know.
          if (event.spottedBy === this.id) {
              // Self-knowledge: High confidence
              this.internalThreatMap[event.zoneId] = { level: 100, timestamp: event.timestamp };
          } else {
              // Teammate communication
              const comms = this.player.skills.mental.communication;
              // Chance to miss info? Or simply degraded info.
              // Let's say high comms = instant accurate update. Low comms = delayed or lower threat level.
              // For simplicity: Update threat map.
              this.internalThreatMap[event.zoneId] = { level: 80, timestamp: event.timestamp };
          }
      } else if (event.type === "TEAMMATE_DIED") {
          // Teammate died at zoneId. HIGH THREAT.
          this.internalThreatMap[event.zoneId] = { level: 100, timestamp: event.timestamp };
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

      // CT Emergency Rotation Boost - sprint when bomb is planted
      if (this.side === TeamSide.CT && (this.aiState === BotAIState.DEFUSING || this.aiState === BotAIState.ROTATING)) {
          this.isShiftWalking = false; // Never walk during retakes
          speed *= 1.20; // 20% faster rotation (increased from 15%)
      }

      return speed;
  }

  makeNoise(): number {
      if (this.targetZoneId && !this.isShiftWalking) {
          return 10;
      }
      return 0;
  }

  private calculateGlobalThreat(map: GameMap, currentTick: number): number {
      let totalThreat = 0;
      // Cleanup old threats
      for (const zoneId in this.internalThreatMap) {
          const entry = this.internalThreatMap[zoneId];
          const age = currentTick - entry.timestamp;
          if (age > 50) { // Decay after 5 seconds
               delete this.internalThreatMap[zoneId];
          } else {
               totalThreat += entry.level;
          }
      }
      return totalThreat;
  }

  updateGoal(map: GameMap, bomb: Bomb, tacticsManager: TacticsManager, zoneStates: Record<string, { noiseLevel: number }>, currentTick: number = 0, allBots: Bot[] = []) {
    if (this.status === "DEAD") return;

    if (this.combatCooldown > 0) {
      this.combatCooldown--;
    }

    if (this.utilityCooldown > 0) {
      this.utilityCooldown--;
    }

    // Reset transient flags
    this.isEntryFragger = false;

    if (this.stunTimer > 0) {
      this.stunTimer--;
    }

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
                 // At entry zone
                 // Check if we can/should throw utility
                 if (this.utilityCooldown <= 0) {
                     const role = tacticsManager.getRole(this.id);
                     const isSupport = role === "Support";

                     // If Support, always try to throw if inventory exists.
                     // If not Support, throw only if haven't thrown yet.
                     if (isSupport || !this.hasThrownEntryUtility) {
                         const nextUtil = this.getNextGrenadeType();
                         if (nextUtil) {
                             // Start Charging
                             this.activeUtility = nextUtil;
                             const utilitySkill = this.player.skills.technical.utility;
                             const chargeTimeMs = 3000 - (utilitySkill * 10);
                             this.utilityChargeTimer = Math.max(1, Math.ceil(chargeTimeMs / 500));
                             this.isChargingUtility = true;
                             this.aiState = BotAIState.CHARGING_UTILITY;
                             return;
                         }
                     }
                 } else {
                     // Cooldown active.
                     // If Support and have more nades -> Wait.
                     const role = tacticsManager.getRole(this.id);
                     if (role === "Support" && (this.player.inventory?.grenades.length ?? 0) > 0) {
                         this.aiState = BotAIState.HOLDING_ANGLE;
                         return;
                     }
                 }
             }
         }
    }

    let desiredGoal: string | null = null;
    let desiredState = BotAIState.DEFAULT;

    // --- CT LOGIC ---
    if (this.side === TeamSide.CT) {
      // 1. Check Bomb Status
      this.sprintMultiplier = 1.0;

      if (bomb.status === BombStatus.PLANTED) {
         this.isShiftWalking = false; // Fix 3: Sprint
         if (this.aiState === BotAIState.DEFUSING || this.aiState === BotAIState.DEFAULT || this.aiState === BotAIState.WAITING_FOR_SPLIT) {
             this.sprintMultiplier = 1.2; // Fix 3: Boost
         }

         const defuseTime = this.player.inventory?.hasDefuseKit ? 50 : 100;
         const timeRemaining = bomb.timer;
         const distanceToSite = map.getDistance(this.currentZoneId, bomb.plantSite || "");
         // Estimate travel time (ticks) = Distance / (SpeedPerTick). SpeedPerTick = 40 * 1.2 * 0.1 = 4.8.
         const speedPerTick = 40 * 1.2 * 0.1;
         const travelTime = Math.ceil(distanceToSite / speedPerTick);

         if (travelTime + defuseTime > timeRemaining && !bomb.defuserId && bomb.defuserId !== this.id) {
             // Fix 4: Give up if impossible
             desiredState = BotAIState.SAVING;
             desiredGoal = Pathfinder.findFurthestZone(map, bomb.plantSite || this.currentZoneId);
         }
         else {
             desiredState = BotAIState.DEFUSING;
             desiredGoal = bomb.plantSite || null;

             // Retake Coordination: Don't rush in alone, but be more aggressive
             if (desiredGoal && allBots.length > 0) {
                 const siteId = desiredGoal;
                 const myDist = map.getDistance(this.currentZoneId, siteId);

                 const retakingCTs = allBots.filter(b =>
                     b.side === TeamSide.CT &&
                     b.status === "ALIVE" &&
                     b.goalZoneId === siteId &&
                     (b.aiState === BotAIState.DEFUSING || b.aiState === BotAIState.WAITING_FOR_SPLIT)
                 ).length;

                 // If completely alone and close, wait for just 1 teammate (only if time permits)
                 if (retakingCTs === 1 && myDist < 200 && myDist > 50 && timeRemaining > 200) {
                      desiredState = BotAIState.WAITING_FOR_SPLIT;
                      desiredGoal = this.currentZoneId;
                 }
             }

             // Fix 2B: Utility Usage
             if ((desiredState === BotAIState.DEFUSING || desiredState === BotAIState.WAITING_FOR_SPLIT) && desiredGoal) {
                  const dist = map.getDistance(this.currentZoneId, desiredGoal);
                  if (dist < 400 && !this.hasThrownEntryUtility && this.utilityCooldown <= 0) {
                       const nextUtil = this.getNextGrenadeType();
                       if (nextUtil) {
                           this.activeUtility = nextUtil;
                           const utilitySkill = this.player.skills.technical.utility;
                           const chargeTimeMs = 3000 - (utilitySkill * 10);
                           this.utilityChargeTimer = Math.max(1, Math.ceil(chargeTimeMs / 100));
                           this.isChargingUtility = true;
                           this.aiState = BotAIState.CHARGING_UTILITY;
                           return;
                      }
                  }
             }

             if (this.currentZoneId === desiredGoal) {
                 if (!bomb.defuserId || bomb.defuserId === this.id) {
                     // Defuse
                 } else {
                     desiredState = BotAIState.HOLDING_ANGLE;
                 }
             }
         }
      }
      else {
         desiredState = BotAIState.DEFAULT;
         desiredGoal = tacticsManager.getGoalZone(this, map);

         // 2. CT Rotation Logic based on Internal Threat Map and Noise
         const gameSense = this.player.skills.mental.gameSense;

         // Calculate Global Threat
         this.calculateGlobalThreat(map, currentTick);

         // "Guess" Rotation Logic: Check Transition Zones
         // If Mid Doors or Catwalk is high threat, and I am not an anchor on a site under attack, rotate?
         // Actually, if Mid is lost, adjacent zones (Short, B Doors) increase in threat.

         // Let's implement the specific logic: "When a kill occurs at a 'Transition Zone' like Mid Doors... nearest living CT must move to fill that gap."
         // And "CTs at the opposite site should move to 'Aggressive Hold' positions"

         // Check for High Threat in Transition Zones
         const transitionZones = ["mid_doors", "catwalk", "lower_tunnels", "long_doors"];
         let criticalTransition: string | null = null;

         for (const tz of transitionZones) {
             if (this.internalThreatMap[tz]?.level > 80) {
                 criticalTransition = tz;
                 break;
             }
         }

         if (criticalTransition) {
             // A transition zone is compromised.
             // Am I the nearest rotator?
             const myDist = map.getDistance(this.currentZoneId, criticalTransition);

             // Simplification: If I am relatively close (distance < 300) and not currently on a bomb site, I fill the gap.
             const onSite = this.currentZoneId === map.data.bombSites.A || this.currentZoneId === map.data.bombSites.B;

             if (!onSite && myDist < 400) {
                 desiredGoal = criticalTransition;
                 desiredState = BotAIState.ROTATING;
             } else if (onSite) {
                 // I am on site. Opposite site?
                 // If I am on B and Mid is lost, maybe push B Doors/Window (Aggressive Hold)
                 // If I am on A and Mid is lost, maybe push Short (Aggressive Hold)

                 // If critical is Mid Doors (near B/CT):
                 if (criticalTransition === "mid_doors") {
                     if (this.currentZoneId === map.data.bombSites.B) {
                         // Push B Window or B Doors
                         desiredGoal = "b_window"; // Aggressive
                         desiredState = BotAIState.HOLDING_ANGLE;
                     }
                 }
                 // If critical is Catwalk (near A):
                 if (criticalTransition === "catwalk") {
                      if (this.currentZoneId === map.data.bombSites.A) {
                          // Push Short
                          desiredGoal = "a_short";
                          desiredState = BotAIState.HOLDING_ANGLE;
                      }
                 }
             }
         }

         // Fallback to Noise heuristic if no direct event threat
         if (!criticalTransition && gameSense > 70 && this.aiState === BotAIState.DEFAULT) {
            const distToA = Pathfinder.findPath(map, this.currentZoneId, map.data.bombSites.A)?.length || 99;
            const distToB = Pathfinder.findPath(map, this.currentZoneId, map.data.bombSites.B)?.length || 99;

            let targetSiteNoise = 0;
            let otherSite = "";

            if (distToB < distToA) {
                const aZones = ["long_doors", "a_ramp", "a_site", "a_short"];
                aZones.forEach(z => targetSiteNoise += (zoneStates[z]?.noiseLevel || 0));
                otherSite = map.data.bombSites.A;
            } else {
                const bZones = ["upper_tunnels", "b_tunnels", "b_site", "mid_doors"];
                bZones.forEach(z => targetSiteNoise += (zoneStates[z]?.noiseLevel || 0));
                otherSite = map.data.bombSites.B;
            }

            if (targetSiteNoise > 40) {
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
          // Fix 5: Post-Plant Positioning
          if (map.data.postPlantPositions && bomb.plantSite) {
               const siteKey = bomb.plantSite === map.data.bombSites.A ? "A" : "B";
               const spots = map.data.postPlantPositions[siteKey];
               if (spots && spots.length > 0) {
                   let bestSpot = spots[0];
                   let minDist = Infinity;
                   spots.forEach(spot => {
                       const d = map.getDistance(this.currentZoneId, spot);
                       if (d < minDist) {
                           minDist = d;
                           bestSpot = spot;
                       }
                   });
                   desiredGoal = bestSpot;
                   desiredState = BotAIState.HOLDING_ANGLE;
               } else {
                   desiredGoal = bomb.plantSite;
                   desiredState = BotAIState.HOLDING_ANGLE;
               }
          } else {
               desiredState = BotAIState.HOLDING_ANGLE;
               desiredGoal = bomb.plantSite || this.currentZoneId;
          }
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

        const prioritizeCover = this.aiState === BotAIState.ROTATING;
        const newPath = Pathfinder.findPath(map, this.currentZoneId, this.goalZoneId, prioritizeCover);
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
        const prioritizeCover = this.aiState === BotAIState.ROTATING;
        const newPath = Pathfinder.findPath(map, this.currentZoneId, this.goalZoneId, prioritizeCover);
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

    // Set Focus Zone
    if (this.targetZoneId) {
        this.focusZoneId = this.targetZoneId;
    } else if (this.goalZoneId) {
        // If holding, look at goal, or look at dangerous connection?
        // For simplicity, look at goal if not at goal, or look at 'front' if at goal.
        // If at goal, we need a default look direction.
        // We can pick the connection with highest threat or default connection.
        if (this.currentZoneId === this.goalZoneId) {
             const zone = map.getZone(this.currentZoneId);
             // Pick first connection that isn't where we came from?
             // Or pick connection with highest threat.
             let bestLook = zone?.connections[0] || null;
             let maxThreat = -1;

             zone?.connections.forEach(conn => {
                 const threat = this.internalThreatMap[conn]?.level || 0;
                 if (threat > maxThreat) {
                     maxThreat = threat;
                     bestLook = conn;
                 }
             });
             this.focusZoneId = bestLook;
        } else {
            // Looking towards next step in path?
            if (this.path.length > 0) this.focusZoneId = this.path[0];
            else this.focusZoneId = this.goalZoneId;
        }
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

  private getNextGrenadeType(): string | null {
      const g = this.player.inventory?.grenades || [];
      if (g.length === 0) return null;
      // Priority: Smoke > Molotov > Flash > HE
      if (g.includes("smoke")) return "smoke";
      if (g.includes("molotov")) return "molotov";
      if (g.includes("incendiary")) return "incendiary";
      if (g.includes("flashbang")) return "flashbang";
      if (g.includes("he")) return "he";
      return g[0];
  }
}
