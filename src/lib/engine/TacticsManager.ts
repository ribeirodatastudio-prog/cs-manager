import { Bot } from "./Bot";
import { GameMap } from "./GameMap";
import { TACTIC_ROLES } from "./tacticRoles";

export enum TeamSide {
  T = "T",
  CT = "CT",
}

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
  role?: string; // "Anchor", "Rotator", "Lurker", "Support"
}

export class TacticsManager {
  private strategies: Record<TeamSide, TeamStrategy>;
  private assignments: Record<string, BotAssignment> = {}; // BotId -> Assignment
  private roleAssignments: Record<string, string> = {}; // BotId -> RoleName (Specific)

  constructor() {
    this.strategies = {
      T: { tactic: "DEFAULT", stage: "SETUP" },
      CT: { tactic: "STANDARD", stage: "SETUP" },
    };
  }

  setTactic(side: TeamSide, tactic: Tactic) {
    this.strategies[side].tactic = tactic;
    this.strategies[side].stage = "SETUP"; // Reset stage on change
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

  public getRole(botId: string): string | undefined {
      return this.assignments[botId]?.role;
  }

  public setRoleAssignments(assignments: Record<string, string>) {
      this.roleAssignments = assignments;
  }

  /**
   * Initializes or updates assignments for the round based on current tactics.
   */
  updateAssignments(bots: Bot[], map: GameMap) {
      bots.forEach(bot => {
          if (bot.status === "DEAD") return;

          const side = bot.side;
          const tactic = this.getTactic(side);
          const roleName = this.roleAssignments[bot.id];

          let targetZone = side === TeamSide.T ? "mid" : "ct_spawn"; // Fallback
          let behaviorRole = "Rifler";
          let splitGroup = null;

          if (roleName) {
               const roleDef = TACTIC_ROLES[tactic]?.find(r => r.name === roleName);
               if (roleDef) {
                   behaviorRole = roleDef.behavior;

                   // Resolve Target based on Role Name
                   const resolution = this.resolveRoleTarget(roleName, tactic, map);
                   targetZone = resolution.target;
                   if (resolution.group) splitGroup = resolution.group;
               }
          }

          // Update Bot State
          bot.roundRole = behaviorRole;
          bot.splitGroup = splitGroup;

          // Store Assignment
          this.assignments[bot.id] = {
              targetZoneId: targetZone,
              role: behaviorRole,
              group: splitGroup || undefined
          };
      });
  }

  private resolveRoleTarget(roleName: string, tactic: Tactic, map: GameMap): { target: string; group?: string } {
      const sites = map.data.bombSites;

      // --- CT TACTICS ---
      if (tactic === "STANDARD") {
          if (roleName === "Anchor A") return { target: sites.A };
          if (roleName === "Support A / Rotator") return { target: "long_doors" }; // Or A Ramp
          if (roleName === "Mid Player") return { target: "mid_doors" };
          if (roleName === "Support B / Rotator") return { target: "b_doors" };
          if (roleName === "Anchor B") return { target: sites.B };
      }
      if (tactic === "AGGRESSIVE_PUSH") {
          // Push Top Mid / Catwalk
          if (roleName.includes("Aggressor") || roleName.includes("Flasher")) return { target: "top_mid" };
          if (roleName === "Passive Anchor 1") return { target: sites.A }; // Hold A
          if (roleName === "Passive Rotator") return { target: "ct_spawn" };
      }
      if (tactic === "GAMBLE_STACK_A") {
          if (roleName === "Solo Anchor B") return { target: sites.B };
          return { target: sites.A };
      }
      if (tactic === "GAMBLE_STACK_B") {
          if (roleName === "Solo Anchor A") return { target: sites.A };
          return { target: sites.B };
      }
      if (tactic === "RETAKE_SETUP") {
          // Play passive / outside sites
          if (roleName.includes("Retake Entry")) return { target: "ct_spawn" };
          if (roleName === "Flank Watcher") return { target: "mid_doors" };
          return { target: "ct_spawn" };
      }

      // --- T TACTICS ---
      if (tactic === "DEFAULT") {
          if (roleName.includes("Entry")) return { target: "top_mid" };
          if (roleName === "Support") return { target: "outside_long" };
          if (roleName === "Mid Controller") return { target: "mid_doors" };
          if (roleName === "Lurker") return { target: "upper_tunnels" };
          if (roleName.includes("IGL")) return { target: "outside_tunnels" };
      }
      if (tactic === "RUSH_A" || tactic === "EXECUTE_A") {
          if (roleName.includes("Lurker")) return { target: "mid_doors" }; // Cut-off
          return { target: sites.A };
      }
      if (tactic === "RUSH_B" || tactic === "EXECUTE_B") {
          if (roleName.includes("Lurker")) return { target: "mid_doors" }; // Cut-off
          return { target: sites.B };
      }
      if (tactic === "CONTACT_A") {
          if (roleName === "Lurker") return { target: sites.B }; // Fake
          return { target: sites.A };
      }
      if (tactic === "CONTACT_B") {
          if (roleName === "Lurker") return { target: sites.A }; // Fake
          return { target: sites.B };
      }
      if (tactic === "SPLIT_A") {
          // Pincer Points
          const splitData = map.data.strategies?.split.A;
          const mainGroup = splitData ? splitData[0].pincerPoint : sites.A; // Long
          const midGroup = splitData ? splitData[1].pincerPoint : "catwalk"; // Short

          if (roleName === "Lurker") return { target: "ct_spawn" }; // Flank
          if (roleName.includes("Main Group")) return { target: mainGroup, group: "Main" };
          if (roleName.includes("Mid/Split")) return { target: midGroup, group: "Mid" };
          return { target: mainGroup }; // Fallback
      }
      if (tactic === "SPLIT_B") {
          const splitData = map.data.strategies?.split.B;
          const mainGroup = splitData ? splitData[0].pincerPoint : sites.B; // Tunnels
          const midGroup = splitData ? splitData[1].pincerPoint : "mid_doors"; // Mid

          if (roleName === "Lurker") return { target: "ct_spawn" };
          if (roleName.includes("Main Group")) return { target: mainGroup, group: "Main" };
          if (roleName.includes("Mid/Split")) return { target: midGroup, group: "Mid" };
          return { target: mainGroup };
      }

      // Default Fallback
      return { target: tactic.includes("_A") ? sites.A : sites.B };
  }

  /**
   * Returns the target zone ID for a given bot based on strategy state.
   */
  getGoalZone(bot: Bot, map: GameMap): string {
    const side = bot.side;
    const strategy = this.strategies[side];
    const assignment = this.assignments[bot.id];

    if (!assignment) {
        return side === "T" ? "mid" : "ct_spawn";
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
