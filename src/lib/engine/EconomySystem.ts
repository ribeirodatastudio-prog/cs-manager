import { ECONOMY, TeamSide } from "./constants";
import { MatchState, RoundEndReason } from "./types";

export class EconomySystem {
  /**
   * Calculates the income for a team based on the round result.
   */
  public static calculateIncome(
    side: TeamSide,
    winner: TeamSide,
    reason: RoundEndReason,
    lossBonusLevel: number, // 0-4
    bombPlanted: boolean
  ): number {
    if (side === winner) {
      // Win Rewards
      switch (reason) {
        case RoundEndReason.ELIMINATION_T:
        case RoundEndReason.ELIMINATION_CT:
        case RoundEndReason.TIME_RUNNING_OUT: // CT Win
          return ECONOMY.WIN_REWARD_ELIMINATION; // 3250
        case RoundEndReason.TARGET_BOMBED: // T Win
          return ECONOMY.WIN_REWARD_BOMB_EXPLODED; // 3500
        case RoundEndReason.BOMB_DEFUSED: // CT Win
          return ECONOMY.WIN_REWARD_BOMB_DEFUSED; // 3500
        default:
          return ECONOMY.WIN_REWARD_ELIMINATION;
      }
    } else {
      // Loss Rewards
      let income = ECONOMY.LOSS_BONUS_START + (lossBonusLevel * ECONOMY.LOSS_BONUS_INCREMENT);
      if (income > ECONOMY.LOSS_BONUS_MAX) income = ECONOMY.LOSS_BONUS_MAX;

      // T Bonus for planting (even if lost)
      if (side === TeamSide.T && bombPlanted) {
        income += ECONOMY.PLANT_BONUS_TEAM;
      }

      return income;
    }
  }

  /**
   * Updates the Loss Bonus Level (0-4).
   * Decreases by 1 on Win (min 0).
   * Increases by 1 on Loss (max 4).
   */
  public static updateLossBonus(
    currentLevel: number,
    wonRound: boolean
  ): number {
    if (wonRound) {
      return Math.max(0, currentLevel - 1);
    } else {
      return Math.min(4, currentLevel + 1);
    }
  }

  /**
   * Special rule: "First round of a half loss immediately sets the bonus to $1,900."
   * In our system, $1900 corresponds to Level 1 (1400 + 1*500).
   * Level 0 = 1400.
   */
  public static getPistolRoundLossLevel(): number {
    return 1; // Corresponds to $1900
  }
}
