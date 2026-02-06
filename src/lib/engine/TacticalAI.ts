/**
 * Advanced Tactical AI for CS2 Bot Behavior
 * Includes angle clearing, strategic positioning, and coordinated team play
 */
import { Point } from "./types";
import { GameMap } from "./GameMap";
import type { Bot } from "./Bot";
import { TeamSide } from "./TacticsManager";
import { TACTICAL_BEHAVIORS } from "./cs2Constants";

export interface AngleToClear {
  position: Point;
  dangerLevel: number;
  priorityOrder: number;
}

export interface TacticalPosition {
  position: Point;
  coverValue: number;
  sightlines: string[]; // Zone IDs visible from this position
  isDefensive: boolean;
}

/**
 * Advanced Tactical AI System
 */
export class TacticalAI {
  /**
   * Get angles that need to be cleared when entering a zone
   */
  static getAnglesToClear( currentZoneId: string, targetZoneId: string, map: GameMap, side: TeamSide ): AngleToClear[] {
    const angles: AngleToClear[] = [];
    // Define common angles for key zones
    const angleDatabase = this.getAngleDatabase();

    const transition = `${currentZoneId}->${targetZoneId}`;
    const zoneAngles = angleDatabase[transition];

    if (zoneAngles) {
      return zoneAngles;
    }

    // If no specific angles defined, get default based on zone
    return this.getDefaultAngles(targetZoneId, map);
  }

  /**
   * Database of pre-defined angles to clear for common transitions
   */
  private static getAngleDatabase(): Record<string, AngleToClear[]> {
    return {
      // Long A approaches
      "long_doors->long_corner": [
        { position: { x: 920, y: 640 }, dangerLevel: 0.9, priorityOrder: 1 }, // Pit angle
        { position: { x: 900, y: 680 }, dangerLevel: 0.7, priorityOrder: 2 } // Corner angle
      ],
      "long_corner->long_pit": [
        { position: { x: 940, y: 600 }, dangerLevel: 0.8, priorityOrder: 1 }, // Pit position
        { position: { x: 920, y: 580 }, dangerLevel: 0.6, priorityOrder: 2 } // Ramp angle
      ],

      // Short/Cat approaches
      "catwalk_upper->catwalk_lower": [
        { position: { x: 600, y: 430 }, dangerLevel: 0.8, priorityOrder: 1 }, // Short angle
        { position: { x: 620, y: 450 }, dangerLevel: 0.6, priorityOrder: 2 } // Mid angle
      ],
      "catwalk_lower->a_short": [
        { position: { x: 686, y: 270 }, dangerLevel: 0.9, priorityOrder: 1 }, // Site angle
        { position: { x: 700, y: 250 }, dangerLevel: 0.7, priorityOrder: 2 } // Boxes angle
      ],

      // Mid control
      "top_mid->upper_mid": [
        { position: { x: 515, y: 600 }, dangerLevel: 0.8, priorityOrder: 1 }, // Xbox
        { position: { x: 480, y: 500 }, dangerLevel: 0.9, priorityOrder: 2 } // Suicide cross
      ],
      "upper_mid->xbox": [
        { position: { x: 525, y: 585 }, dangerLevel: 0.7, priorityOrder: 1 }, // Xbox top
        { position: { x: 500, y: 430 }, dangerLevel: 0.6, priorityOrder: 2 } // Lower mid
      ],

      // B site approaches
      "upper_tunnels->b_tunnels": [
        { position: { x: 140, y: 380 }, dangerLevel: 0.8, priorityOrder: 1 }, // Tunnels exit
        { position: { x: 130, y: 350 }, dangerLevel: 0.6, priorityOrder: 2 } // Pre-site
      ],
      "b_tunnels->b_site": [
        { position: { x: 134, y: 220 }, dangerLevel: 0.9, priorityOrder: 1 }, // Site center
        { position: { x: 175, y: 230 }, dangerLevel: 0.8, priorityOrder: 2 }, // Closet
        { position: { x: 150, y: 160 }, dangerLevel: 0.7, priorityOrder: 3 } // Back plat
      ]
    };
  }

  /**
   * Get default angles for a zone if no specific angles defined
   */
  private static getDefaultAngles(zoneId: string, map: GameMap): AngleToClear[] {
    const zone = map.getZone(zoneId);
    if (!zone) return [];
    const angles: AngleToClear[] = [];

    // Add connected zones as potential danger points
    zone.connections.forEach((conn, index) => {
      const connZone = map.getZone(conn.to);
      if (connZone) {
        angles.push({
          position: { x: connZone.x, y: connZone.y },
          dangerLevel: 0.5,
          priorityOrder: index + 1
        });
      }
    });

    return angles;
  }

  /**
   * Calculate if bot should pre-fire based on position and known intel
   */
  static shouldPrefire( bot: Bot, targetPosition: Point, threatLevel: number ): boolean {
    const dx = targetPosition.x - bot.pos.x;
    const dy = targetPosition.y - bot.pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    // Only prefire at high threat levels and within range
    return threatLevel > 0.7 && distance < TACTICAL_BEHAVIORS.SHOULD_PREFIRE_RANGE;
  }

  /**
   * Get optimal position for holding an angle in a zone
   */
  static getHoldPosition( zoneId: string, map: GameMap, holdingFor: 'offense' | 'defense' ): TacticalPosition | null {
    const zone = map.getZone(zoneId);
    if (!zone) return null;
    // Pre-defined hold positions for key zones
    const holdPositions = this.getHoldPositionDatabase();
    const key = `${zoneId}_${holdingFor}`;

    if (holdPositions[key]) {
      return holdPositions[key];
    }

    // Default: use zone center with cover value
    return {
      position: { x: zone.x, y: zone.y },
      coverValue: zone.cover,
      sightlines: zone.connections.map(c => c.to),
      isDefensive: holdingFor === 'defense'
    };
  }

  /**
   * Database of optimal hold positions
   */
  private static getHoldPositionDatabase(): Record<string, TacticalPosition> {
    return {
      // A site defensive positions
      "a_site_defense": { position: { x: 780, y: 210 }, coverValue: 0.8, sightlines: ["a_ramp", "a_short", "a_default"], isDefensive: true },
      "a_default_defense": { position: { x: 815, y: 175 }, coverValue: 0.9, sightlines: ["a_ramp", "ct_ramp"], isDefensive: true },

      // Long A defensive
      "long_pit_defense": { position: { x: 945, y: 615 }, coverValue: 0.9, sightlines: ["long_corner", "long_a"], isDefensive: true },
      "long_corner_defense": { position: { x: 895, y: 670 }, coverValue: 0.8, sightlines: ["long_doors", "long_pit"], isDefensive: true },

      // Short defensive
      "a_short_defense": { position: { x: 690, y: 265 }, coverValue: 0.7, sightlines: ["catwalk_upper", "a_site"], isDefensive: true },
      "catwalk_lower_defense": { position: { x: 615, y: 425 }, coverValue: 0.6, sightlines: ["catwalk_upper", "ct_cat"], isDefensive: true },

      // Mid defensive
      "xbox_defense": { position: { x: 520, y: 585 }, coverValue: 0.8, sightlines: ["upper_mid", "suicide", "lower_mid"], isDefensive: true },
      "ct_mid_defense": { position: { x: 490, y: 335 }, coverValue: 0.7, sightlines: ["lower_mid", "ct_cat", "mid_doors"], isDefensive: true },

      // B site defensive
      "b_site_defense": { position: { x: 145, y: 215 }, coverValue: 0.8, sightlines: ["b_tunnels", "b_window", "b_doors"], isDefensive: true },
      "b_closet_defense": { position: { x: 178, y: 232 }, coverValue: 0.95, sightlines: ["b_site", "b_doors"], isDefensive: true },
      "b_back_plat_defense": { position: { x: 125, y: 152 }, coverValue: 0.9, sightlines: ["b_default", "b_window"], isDefensive: true },

      // Offensive positions (T-side)
      "long_doors_offense": { position: { x: 892, y: 668 }, coverValue: 0.6, sightlines: ["long_corner", "outside_long"], isDefensive: false },
      "catwalk_upper_offense": { position: { x: 655, y: 365 }, coverValue: 0.5, sightlines: ["a_short", "catwalk_lower"], isDefensive: false },
      "upper_tunnels_offense": { position: { x: 138, y: 710 }, coverValue: 0.7, sightlines: ["b_tunnels", "lower_tunnels"], isDefensive: false }
    };
  }

  /**
   * Determine if bot should use utility at current position
   */
  static shouldUseUtility( bot: Bot, targetZoneId: string, utilityType: 'flash' | 'smoke' | 'he' | 'molotov', enemyCount: number ): boolean {
    // Don't use utility if already charging
    if (bot.isChargingUtility || bot.utilityCooldown > 0) return false;
    // Check if bot has the utility
    const hasUtility = bot.player.inventory?.grenades?.includes(utilityType) ?? false;
    if (!hasUtility) return false;

    // Different logic based on utility type
    switch (utilityType) {
      case 'flash':
        // Use flash when entering contested area
        return enemyCount > 0 && !bot.hasThrownEntryUtility;

      case 'smoke':
        // Use smoke to block sightlines
        return enemyCount > 1 || bot.roundRole === "Support";

      case 'he':
        // Use HE for damage when enemies grouped
        return enemyCount >= 2;

      case 'molotov':
        // Use molotov for area denial
        return bot.side === TeamSide.T ?
          (enemyCount > 0 && targetZoneId.includes("site")) :
          (enemyCount > 0); // CT uses for delay

      default:
        return false;
    }
  }

  /**
   * Calculate peek duration based on player skill and situation
   */
  static calculatePeekDuration( bot: Bot, dangerLevel: number ): number {
    const baseTime = TACTICAL_BEHAVIORS.CLEAR_ANGLE_PAUSE;
    const skill = bot.player.skills.technical.firstBulletPrecision / 100;
    // Higher skill = faster peeks
    // Higher danger = shorter peeks
    const skillModifier = 1 - (skill * 0.3);
    const dangerModifier = 1 - (dangerLevel * 0.4);

    return Math.round(baseTime * skillModifier * dangerModifier);
  }

  /**
   * Get utility throw position for specific tactics
   */
  static getUtilityThrowPosition( fromZoneId: string, targetZoneId: string, utilityType: 'flash' | 'smoke' | 'molotov' ): Point | null {
    // Pre-defined utility lineups
    const lineups: Record<string, Record<string, Point>> = {
      // A Long smokes
      "outside_long": {
        smoke_long_doors: { x: 750, y: 820 },
        flash_long_corner: { x: 730, y: 810 }
      },

      // Short smokes
      "catwalk_upper": {
        smoke_ct_cat: { x: 655, y: 370 },
        flash_a_short: { x: 648, y: 365 }
      },

      // Mid smokes
      "top_mid": {
        smoke_xbox: { x: 490, y: 830 },
        smoke_ct_mid: { x: 485, y: 820 }
      },

      // B smokes
      "upper_tunnels": {
        smoke_b_site: { x: 140, y: 720 },
        flash_b_tunnels: { x: 135, y: 710 },
        molotov_b_default: { x: 138, y: 705 }
      }
    };

    const zoneLineups = lineups[fromZoneId];
    if (!zoneLineups) return null;

    const key = `${utilityType}_${targetZoneId}`;
    return zoneLineups[key] || null;
  }

  /**
   * Determine movement priority based on role and situation
   */
  static getMovementPriority( bot: Bot, roundTimer: number, bombPlanted: boolean ): number {
    let priority = 1.0;
    // Entry fraggers move fastest
    if (bot.roundRole === "Entry Fragger") priority *= 1.1;

    // AWPers slower, more methodical
    const hasAWP = bot.player.inventory?.primaryWeapon === "awp";
    if (hasAWP) priority *= 0.85;

    // Time pressure for T side
    if (bot.side === TeamSide.T && !bombPlanted) {
      if (roundTimer < 30) priority *= 1.3; // Rush
      else if (roundTimer < 60) priority *= 1.15; // Urgency
    }

    // CT rotating after plant
    if (bot.side === TeamSide.CT && bombPlanted) {
      priority *= 1.2; // Must get to site
    }

    return priority;
  }
}
