import { Player } from "@/types";
import { TacticsManager, TeamSide } from "./TacticsManager";
import { GameMap } from "./GameMap";
import { Pathfinder } from "./Pathfinder";

export type BotStatus = "ALIVE" | "DEAD";

export interface BotAction {
  type: "MOVE" | "HOLD" | "IDLE";
  targetZoneId?: string;
}

export class Bot {
  public id: string;
  public player: Player;
  public side: TeamSide;
  public hp: number;
  public status: BotStatus;
  public currentZoneId: string;
  public path: string[];

  constructor(player: Player, side: TeamSide, startZoneId: string) {
    this.id = player.id;
    this.player = player;
    this.side = side;
    this.hp = 100;
    this.status = "ALIVE";
    this.currentZoneId = startZoneId;
    this.path = [];
  }

  /**
   * Decides the next action for the bot based on state, aggression, and tactics.
   */
  decideAction(map: GameMap, tacticsManager: TacticsManager): BotAction {
    if (this.status === "DEAD") return { type: "IDLE" };

    // 1. Get Goal
    const goalZoneId = tacticsManager.getGoalZone(this.player, this.side);

    // 2. Check if we need a path
    // If we have no path, or the last node in path is not the goal (goal changed)
    const needsPath =
      this.path.length === 0 ||
      this.path[this.path.length - 1] !== goalZoneId;

    if (needsPath && this.currentZoneId !== goalZoneId) {
       const newPath = Pathfinder.findPath(map, this.currentZoneId, goalZoneId);
       if (newPath) {
         // Path includes start node usually? My Pathfinder returns [start, ... end].
         // We need to remove the start node if it's our current position.
         if (newPath[0] === this.currentZoneId) {
            newPath.shift();
         }
         this.path = newPath;
       }
    }

    // 3. Decide Move vs Hold based on Aggression
    // Aggression 1-200.
    // 200 Aggression -> Always Move?
    // 1 Aggression -> Always Hold?
    // Let's bias it. Even aggro players hold sometimes.
    // Base move chance 50%. Aggression shifts it +/- 40%.
    // Aggression 100 -> 50% move.
    // Aggression 200 -> 90% move.
    // Aggression 0 -> 10% move.

    // If we are AT the goal, we should HOLD.
    if (this.currentZoneId === goalZoneId) {
      return { type: "HOLD" };
    }

    const moveChance = 0.1 + (this.player.skills.mental.aggression / 200) * 0.8;
    const roll = Math.random();

    if (roll < moveChance && this.path.length > 0) {
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
