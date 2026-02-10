/**
 * Bot Vision System
 * Manages what bots can see based on navmesh and game state
 */
import { Point } from "./types";
import { enhancedNavMeshManager } from "./EnhancedNavMeshManager";
import type { Bot } from "./Bot";
import type { GameMap } from "./GameMap";

export interface VisibleEntity {
  id: string;
  position: Point;
  type: "player" | "bomb" | "utility" | "weapon";
  distance: number;
  lastSeen: number; // Tick when last seen
}

export interface VisionCone {
  position: Point;
  direction: number; // Angle in radians
  fov: number; // Field of view in radians
  range: number; // Maximum vision distance
}

/**
 * Bot Vision System
 */
export class BotVisionSystem {
  private static readonly DEFAULT_FOV = Math.PI * 0.75; // 135 degrees
  private static readonly MAX_VISION_RANGE = 3000;
  private static readonly PERIPHERAL_VISION_MULTIPLIER = 0.7;

  /**
   * Get all entities visible to a bot
   */
  static getVisibleEntities(
    bot: Bot,
    allBots: Bot[],
    otherEntities: { position: Point; id: string; type: "player" | "bomb" | "utility" | "weapon" }[] = []
  ): VisibleEntity[] {
    const visible: VisibleEntity[] = [];

    // Get bot's vision cone
    const visionCone = this.getBotVisionCone(bot);

    // Check other bots
    for (const otherBot of allBots) {
      if (otherBot.id === bot.id) continue;
      if (otherBot.status === "DEAD") continue;
      if (otherBot.side === bot.side) continue; // Same team

      if (this.isInVisionCone(otherBot.pos, visionCone)) {
        const distance = this.getDistance(bot.pos, otherBot.pos);

        // Check if we have clear line of sight
        if (enhancedNavMeshManager.hasLineOfSight(bot.pos, otherBot.pos)) {
          visible.push({
            id: otherBot.id,
            position: { ...otherBot.pos },
            type: "player",
            distance,
            lastSeen: Date.now()
          });
        }
      }
    }

    // Check other entities (bombs, weapons, etc.)
    for (const entity of otherEntities) {
      if (this.isInVisionCone(entity.position, visionCone)) {
        const distance = this.getDistance(bot.pos, entity.position);

        if (enhancedNavMeshManager.hasLineOfSight(bot.pos, entity.position)) {
          visible.push({
            id: entity.id,
            position: { ...entity.position },
            type: entity.type,
            distance,
            lastSeen: Date.now()
          });
        }
      }
    }

    return visible;
  }

  /**
   * Get bot's current vision cone based on position and aim
   */
  static getBotVisionCone(bot: Bot): VisionCone {
    // Calculate direction bot is facing based on movement or last known target
    let direction = 0;

    if (bot.path && bot.path.length > 0) {
      const nextWaypoint = bot.path[0];
      const dx = nextWaypoint.x - bot.pos.x;
      const dy = nextWaypoint.y - bot.pos.y;
      direction = Math.atan2(dy, dx);
    } else if (bot.holdPosition) {
        const dx = bot.holdPosition.x - bot.pos.x;
        const dy = bot.holdPosition.y - bot.pos.y;
        direction = Math.atan2(dy, dx);
    }

    // Shift walking reduces FOV slightly but increases accuracy (focus)
    // Actually typically shifting implies careful movement, maybe wider check?
    // But let's stick to the logic provided: Focus mode narrows FOV?
    // The provided logic said: "Shift walking reduces FOV slightly".
    const fov = bot.isShiftWalking
      ? this.DEFAULT_FOV * 0.9
      : this.DEFAULT_FOV;

    return {
      position: bot.pos,
      direction,
      fov,
      range: this.MAX_VISION_RANGE
    };
  }

  /**
   * Check if a point is within a vision cone
   */
  static isInVisionCone(point: Point, cone: VisionCone): boolean {
    const dx = point.x - cone.position.x;
    const dy = point.y - cone.position.y;

    // Distance check
    const distSq = dx * dx + dy * dy;
    if (distSq > cone.range * cone.range) return false;

    // Angle check
    const angleToPoint = Math.atan2(dy, dx);
    let angleDiff = angleToPoint - cone.direction;

    // Normalize angle difference to [-π, π]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    return Math.abs(angleDiff) <= cone.fov / 2;
  }

  /**
   * Get reaction time based on visibility conditions
   * Returns reaction time in ticks
   */
  static getReactionTime(
    bot: Bot,
    target: Point,
    isInPeripheral: boolean
  ): number {
    // Base reaction time from bot skills (1-200)
    // High skill (200) -> Low reaction time
    // Low skill (1) -> High reaction time
    // Range: 200 -> ~3 ticks (150ms). 50 -> ~18 ticks (900ms).
    const reactionSkill = bot.player.skills.physical.reactionTime || 50;
    const baseReaction = Math.max(3, 23 - (reactionSkill / 10));

    // Peripheral vision is slower
    const peripheralMultiplier = isInPeripheral ? 1.5 : 1.0;

    // Shift walking gives better reaction time (more focused)
    const focusMultiplier = bot.isShiftWalking ? 0.8 : 1.0;

    // Distance affects reaction time
    const distance = this.getDistance(bot.pos, target);
    const distanceMultiplier = 1 + (distance / 2000) * 0.3;

    return Math.round(
      baseReaction * peripheralMultiplier * focusMultiplier * distanceMultiplier
    );
  }

  /**
   * Check if bot can see a specific position
   */
  static canSeePosition(bot: Bot, position: Point): boolean {
    const visionCone = this.getBotVisionCone(bot);

    if (!this.isInVisionCone(position, visionCone)) {
      return false;
    }

    return enhancedNavMeshManager.hasLineOfSight(bot.pos, position);
  }

  /**
   * Get all positions the bot should pre-aim at when entering an area
   */
  static getPreAimPositions(
    bot: Bot,
    targetZoneId: string,
    map: GameMap
  ): Point[] {
    const positions: Point[] = [];
    const zone = map.getZone(targetZoneId);

    if (!zone) return positions;

    // Get visible positions from the zone center
    const visiblePositions = enhancedNavMeshManager.getVisiblePositions(
      { x: zone.x, y: zone.y },
      1000 // Within 1000 units
    );

    // Filter to positions with good cover (likely holding spots)
    for (const pos of visiblePositions) {
      const nearbyNodes = enhancedNavMeshManager.getNodesInRadius(pos, 50);

      for (const node of nearbyNodes) {
        // High cover score = good holding position
        if (node.coverScore && node.coverScore > 0.6) {
          positions.push({ x: node.pos[0], y: node.pos[1] });
        }
      }
    }

    return positions;
  }

  /**
   * Calculate optimal peek position to see a target area
   */
  static getOptimalPeekPosition(
    currentPos: Point,
    targetArea: Point,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    map: GameMap
  ): Point | null {
    // Find nearby positions that can see the target
    const nearbyNodes = enhancedNavMeshManager.getNodesInRadius(currentPos, 150);

    let bestPosition: Point | null = null;
    let bestScore = -1;

    for (const node of nearbyNodes) {
      const nodePos = { x: node.pos[0], y: node.pos[1] };

      // Can this position see the target?
      if (!enhancedNavMeshManager.hasLineOfSight(nodePos, targetArea)) {
        continue;
      }

      // Score based on cover and distance
      const coverScore = node.coverScore || 0;
      const distance = this.getDistance(currentPos, nodePos);
      const distanceScore = 1 - Math.min(distance / 150, 1); // Prefer closer positions

      const totalScore = coverScore * 0.6 + distanceScore * 0.4;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestPosition = nodePos;
      }
    }

    return bestPosition;
  }

  /**
   * Determine if bot should pre-fire based on intel
   */
  static shouldPrefire(
    bot: Bot,
    suspectedPosition: Point,
    threatLevel: number
  ): boolean {
    // High threat level and good aim = pre-fire
    const aimSkill = bot.player.skills.technical.shooting || 50;
    const gameIQ = bot.player.skills.mental.gameSense || 50;

    const prefireThreshold = 0.7 - (aimSkill / 400) - (gameIQ / 800); // 200 skill -> -0.5, so threshold reduced by 0.5.
    // 0.7 - 0.5 - 0.25 = -0.05. Always prefire if high skill?
    // Let's adjust:
    // 0.7 base.
    // 200 aim -> 0.2. 200 gameSense -> 0.1.
    // 0.7 - 0.2 - 0.1 = 0.4.
    // So if threat > 40%, prefire.

    // Normal skill (100): 0.7 - 0.1 - 0.05 = 0.55.

    return threatLevel > Math.max(0.2, prefireThreshold);
  }

  /**
   * Get smoke/flash impact on vision
   */
  static getVisionReduction(
    bot: Bot,
    activeUtility: Array<{ type: string; position: Point; radius: number }>
  ): number {
    let reduction = 1.0; // No reduction

    for (const util of activeUtility) {
      const distance = this.getDistance(bot.pos, util.position);

      if (util.type === "smoke" && distance < util.radius) {
        // Inside smoke = severely reduced vision
        reduction *= 0.1;
      } else if (util.type === "flash") {
        // Flash effect (simplified)
        if (distance < util.radius * 2) {
          reduction *= 0.3;
        }
      }
    }

    return Math.max(reduction, 0.05); // Minimum 5% vision
  }

  /**
   * Get expected engagement positions based on common angles
   */
  static getCommonAngles(zoneId: string): Point[] {
    // This would be populated from a database of common holding positions
    // Coordinates should be verified to be VISUAL coordinates if that's what we use.
    // Assuming visual coordinates for now.
    const commonAngles: Record<string, Point[]> = {
      "a_site": [
        { x: 686, y: 270 }, // Default
        { x: 700, y: 250 }, // Ninja
        { x: 650, y: 290 }  // Boxes
      ],
      "b_site": [
        { x: 134, y: 220 }, // Back plat
        { x: 175, y: 230 }, // Closet
        { x: 150, y: 160 }  // Door
      ],
      "mid": [
        { x: 515, y: 600 }, // Xbox
        { x: 500, y: 430 }  // Lower
      ]
    };

    return commonAngles[zoneId] || [];
  }

  /**
   * Utility: Get distance between two points
   */
  private static getDistance(a: Point, b: Point): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Update bot's knowledge of enemy positions based on vision
   */
  static updateIntelligence(
    bot: Bot,
    visibleEnemies: VisibleEntity[],
    currentTick: number,
    map: GameMap
  ): void {
    // This would update the bot's internal threat map
    for (const enemy of visibleEnemies) {
      // Estimate which zone the enemy is in
      // Update bot.internalThreatMap with this information

      const zone = map.getZoneAt(enemy.position);
      if (zone && bot.internalThreatMap) {
        bot.internalThreatMap.set(zone.id, {
          level: 100,
          timestamp: currentTick
        });
      }
    }
  }
}
