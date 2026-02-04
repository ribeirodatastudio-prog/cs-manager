import { Player } from "@/types";
import { TacticsManager, TeamSide } from "./TacticsManager";
import { GameMap } from "./GameMap";
import { Pathfinder } from "./Pathfinder";
import { ECONOMY } from "./constants";

export type BotStatus = "ALIVE" | "DEAD";

export interface BotAction {
  type: "MOVE" | "HOLD" | "IDLE" | "PLANT" | "DEFUSE";
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
  public hasBomb: boolean = false;
  public isPlanting: boolean = false;
  public isDefusing: boolean = false;

  constructor(player: Player, side: TeamSide, startZoneId: string) {
    this.id = player.id;
    this.player = player;
    this.side = side;
    this.hp = 100;
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
  }

  /**
   * Decides the next action for the bot based on state, aggression, and tactics.
   */
  decideAction(map: GameMap, tacticsManager: TacticsManager): BotAction {
    if (this.status === "DEAD") return { type: "IDLE" };
    if (this.isPlanting) return { type: "PLANT" }; // Continue planting
    if (this.isDefusing) return { type: "DEFUSE" }; // Continue defusing

    // 1. Get Goal
    // If carrying bomb, goal should be a site (TacticsManager should handle this logic ideally)
    // For now, we trust tacticsManager.getGoalZone returns the right spot.
    const goalZoneId = tacticsManager.getGoalZone(this.player, this.side);

    // 2. Check if we need a path
    const needsPath =
      this.path.length === 0 ||
      this.path[this.path.length - 1] !== goalZoneId;

    if (needsPath && this.currentZoneId !== goalZoneId) {
       const newPath = Pathfinder.findPath(map, this.currentZoneId, goalZoneId);
       if (newPath) {
         if (newPath[0] === this.currentZoneId) {
            newPath.shift();
         }
         this.path = newPath;
       }
    }

    // 3. Check for Objective Actions
    // If T, has bomb, at goal (Site) -> PLANT
    if (this.side === "T" && this.hasBomb && this.currentZoneId === goalZoneId) {
        // Assume goal is a site.
        // We return PLANT, MatchSimulator will check if it's a valid site and start timer.
        return { type: "PLANT" };
    }

    // If CT, bomb is planted (MatchSimulator logic needs to tell bot to defuse?)
    // Bot doesn't know global bomb state here easily unless we pass it.
    // For now, if CT is at the bomb site and bomb is active, they should defuse.
    // We'll handle entering DEFUSE state in MatchSimulator or passing context here.
    // But `decideAction` returns what the bot WANTS to do.

    // If we are AT the goal, we should HOLD (or PLANT if T).
    if (this.currentZoneId === goalZoneId) {
      return { type: "HOLD" };
    }

    // 4. Move Logic
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
