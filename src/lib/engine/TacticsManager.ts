import { Player } from "@/types";

export type Tactic = "RUSH_A" | "RUSH_B" | "MID_CONTROL" | "DEFAULT";
export type TeamSide = "T" | "CT";

interface TeamStrategy {
  tactic: Tactic;
}

export class TacticsManager {
  private strategies: Record<TeamSide, TeamStrategy>;

  constructor() {
    this.strategies = {
      T: { tactic: "DEFAULT" },
      CT: { tactic: "DEFAULT" }, // CT Default usually means spread out
    };
  }

  setTactic(side: TeamSide, tactic: Tactic) {
    this.strategies[side].tactic = tactic;
  }

  getTactic(side: TeamSide): Tactic {
    return this.strategies[side].tactic;
  }

  /**
   * Returns the target zone ID for a given player based on the current team tactic.
   */
  getGoalZone(player: Player, side: TeamSide): string {
    const tactic = this.strategies[side].tactic;

    if (side === "T") {
      switch (tactic) {
        case "RUSH_B":
          return "b_site";
        case "RUSH_A":
          return "a_site";
        case "MID_CONTROL":
          return "mid";
        case "DEFAULT":
        default:
          // Simple default distribution based on roles
          if (player.role === "Entry Fragger") return "long_doors";
          if (player.role === "Star AWPer") return "top_mid";
          if (player.role === "Support") return "outside_tunnels";
           // Fallback to searching for kills or holding
          return "top_mid";
      }
    } else {
      // CT Side Defaults (Defensive holds)
      // Usually CTs hold sites.
      switch (tactic) {
        case "RUSH_A": // CT Counter-strat? Or just standard hold
        case "RUSH_B":
        case "DEFAULT":
        default:
           // Simple 2-1-2 setup logic (or similar) based on roles
           if (player.role === "Star AWPer") return "mid_doors"; // Hold mid
           if (player.role === "Entry Fragger") return "long_a"; // Aggressive long
           if (player.role === "Support") return "b_site"; // Anchor B
           if (player.role === "IGL") return "a_site"; // Anchor A
           if (player.role === "Lurker") return "b_tunnels"; // Push B? Or hold B

           // Fallback
           return "ct_spawn";
      }
    }
  }
}
