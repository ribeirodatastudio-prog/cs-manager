import { Bot } from "./Bot";
import { Zone } from "./types";

export interface DuelResult {
  winnerId: string;
  loserId: string;
  damage: number;
}

export class DuelSystem {
  /**
   * Resolves a duel between two bots in a specific zone.
   * Returns the result of the engagement.
   */
  static resolveDuel(bot1: Bot, bot2: Bot, zone: Zone): DuelResult {
    // Simple combat formula
    // Score = (Shooting + Reaction + Random(0-50)) * (1 + Cover/2)
    // Cover only applies if the bot is "Holding" (defensive bonus)?
    // For now, let's assume if you are in a zone, you use its cover.

    // Skill average for simplicity
    const s1 = bot1.player.skills.technical.shooting;
    const r1 = bot1.player.skills.physical.reactionTime;
    const score1 = (s1 + r1 + Math.random() * 50) * (1 + (zone.cover * 0.5));

    const s2 = bot2.player.skills.technical.shooting;
    const r2 = bot2.player.skills.physical.reactionTime;
    const score2 = (s2 + r2 + Math.random() * 50) * (1 + (zone.cover * 0.5));

    // Winner deals damage.
    // Damage = Base 20 + (Shooting / 10)
    // If headshot (FirstBulletPrecision check?), instakill?
    // Let's keep it HP based.

    if (score1 > score2) {
      const dmg = 20 + (s1 / 5);
      return { winnerId: bot1.id, loserId: bot2.id, damage: dmg };
    } else {
      const dmg = 20 + (s2 / 5);
      return { winnerId: bot2.id, loserId: bot1.id, damage: dmg };
    }
  }
}
