import { Player } from "@/types";
import { TeamSide } from "./constants";
import { Bot } from "./Bot";
import { GameMap } from "./GameMap";
import { MapData } from "./types";

export { TeamSide };

export type Tactic =
  // T Side
  | "RUSH_A" | "RUSH_B"
  | "EXECUTE_A" | "EXECUTE_B"
  | "CONTACT_A" | "CONTACT_B"
  | "SPLIT_A" | "SPLIT_B"
  | "DEFAULT"
  // CT Side
  | "STANDARD"
  | "AGGRESSIVE_PUSH"
  | "GAMBLE_STACK_A" | "GAMBLE_STACK_B"
  | "RETAKE_SETUP";

interface TeamStrategy {
  tactic: Tactic;
  stage: "SETUP" | "EXECUTE"; // For Split/Execute timing
}

interface BotAssignment {
  targetZoneId: string;
  group?: string; // For splits
  role?: string; // "Anchor", "Rotator", "Lurker"
}

export class TacticsManager {
  private strategies: Record<TeamSide, TeamStrategy>;
  private assignments: Record<string, BotAssignment> = {}; // BotId -> Assignment

  constructor() {
    this.strategies = {
      T: { tactic: "DEFAULT", stage: "SETUP" },
      CT: { tactic: "STANDARD", stage: "SETUP" },
    };
  }

  setTactic(side: TeamSide, tactic: Tactic) {
    this.strategies[side].tactic = tactic;
    this.strategies[side].stage = "SETUP"; // Reset stage on change
    // Assignments must be re-evaluated externally or lazily
  }

  getTactic(side: TeamSide): Tactic {
    return this.strategies[side].tactic;
  }

  setStage(side: TeamSide, stage: "SETUP" | "EXECUTE") {
    this.strategies[side].stage = stage;
  }

  getStage(side: TeamSide): "SETUP" | "EXECUTE" {
    return this.strategies[side].stage;
  }

  /**
   * Initializes or updates assignments for the round based on current tactics.
   * Should be called at round start or tactic change.
   */
  updateAssignments(bots: Bot[], map: GameMap) {
      const tBots = bots.filter(b => b.side === TeamSide.T);
      const ctBots = bots.filter(b => b.side === TeamSide.CT);

      this.assignTSide(tBots, map);
      this.assignCTSide(ctBots, map);
  }

  private assignTSide(bots: Bot[], map: GameMap) {
      const tactic = this.strategies.T.tactic;
      const sites = map.data.bombSites;

      // Reset assignments for these bots
      bots.forEach(b => {
          this.assignments[b.id] = { targetZoneId: "mid" }; // Default fallback
      });

      if (tactic === "DEFAULT") {
          // Spread: 2 A-side, 1 Mid, 2 B-side
          // Roles: Entry/IGL -> A/Long. Sniper -> Mid. Support/Lurker -> B.
          // Simple distribution by index
          const zones = ["long_doors", "top_mid", "outside_tunnels", "catwalk", "upper_tunnels"];
          bots.forEach((b, i) => {
              this.assignments[b.id] = { targetZoneId: zones[i % zones.length] };
          });
      }
      else if (tactic === "RUSH_A" || tactic === "EXECUTE_A" || tactic === "CONTACT_A") {
          bots.forEach(b => this.assignments[b.id] = { targetZoneId: sites.A });
      }
      else if (tactic === "RUSH_B" || tactic === "EXECUTE_B" || tactic === "CONTACT_B") {
          bots.forEach(b => this.assignments[b.id] = { targetZoneId: sites.B });
      }
      else if (tactic === "SPLIT_A") {
          // Group 1: Long (3), Group 2: Short (2)
          // MapData strategies logic
          const splitData = map.data.strategies?.split.A;
          if (splitData) {
              bots.forEach((b, i) => {
                  const groupIdx = i < 3 ? 0 : 1; // 3 go main, 2 go other
                  const group = splitData[groupIdx];
                  this.assignments[b.id] = {
                      targetZoneId: group.pincerPoint, // Initially go to pincer
                      group: group.name
                  };
                  b.splitGroup = group.name;
              });
          } else {
              // Fallback if no map data
              bots.forEach(b => this.assignments[b.id] = { targetZoneId: sites.A });
          }
      }
      else if (tactic === "SPLIT_B") {
           const splitData = map.data.strategies?.split.B;
           if (splitData) {
              bots.forEach((b, i) => {
                  const groupIdx = i < 3 ? 0 : 1;
                  const group = splitData[groupIdx];
                  this.assignments[b.id] = {
                      targetZoneId: group.pincerPoint,
                      group: group.name
                  };
                  b.splitGroup = group.name;
              });
           } else {
              bots.forEach(b => this.assignments[b.id] = { targetZoneId: sites.B });
           }
      }
  }

  private assignCTSide(bots: Bot[], map: GameMap) {
      const tactic = this.strategies.CT.tactic;
      const sites = map.data.bombSites;

      bots.forEach(b => this.assignments[b.id] = { targetZoneId: "ct_spawn" });

      if (tactic === "STANDARD" || tactic === "RETAKE_SETUP") {
          // 2-1-2 Setup
          // A: 2, Mid: 1, B: 2
          const distribution = [sites.A, sites.A, "mid_doors", sites.B, sites.B];
          bots.forEach((b, i) => {
              this.assignments[b.id] = { targetZoneId: distribution[i % distribution.length] };
          });
      }
      else if (tactic === "AGGRESSIVE_PUSH") {
          // Push key areas
          const pushes = ["long_doors", "lower_tunnels", "top_mid", "catwalk", "outside_long"];
          bots.forEach((b, i) => {
              this.assignments[b.id] = { targetZoneId: pushes[i % pushes.length] };
          });
      }
      else if (tactic === "GAMBLE_STACK_A") {
          // 4 A, 1 B
           bots.forEach((b, i) => {
              if (i === 0) this.assignments[b.id] = { targetZoneId: sites.B, role: "Anchor" };
              else this.assignments[b.id] = { targetZoneId: sites.A };
          });
      }
      else if (tactic === "GAMBLE_STACK_B") {
           // 4 B, 1 A
           bots.forEach((b, i) => {
              if (i === 0) this.assignments[b.id] = { targetZoneId: sites.A, role: "Anchor" };
              else this.assignments[b.id] = { targetZoneId: sites.B };
          });
      }
  }

  /**
   * Returns the target zone ID for a given bot based on strategy state.
   */
  getGoalZone(bot: Bot, map: GameMap): string {
    const side = bot.side;
    const strategy = this.strategies[side];
    const assignment = this.assignments[bot.id];

    // If no assignment, try to re-assign or fallback
    if (!assignment) {
        // Fallback
        if (side === "T") return "mid";
        return "ct_spawn";
    }

    // Dynamic Handling based on Phase
    if (side === "T") {
        if (strategy.tactic.includes("SPLIT")) {
            if (strategy.stage === "SETUP") {
                return assignment.targetZoneId; // Pincer point
            } else {
                // EXECUTE -> Go to Site
                if (strategy.tactic.includes("_A")) return map.data.bombSites.A;
                return map.data.bombSites.B;
            }
        }
    }

    return assignment.targetZoneId;
  }
}
