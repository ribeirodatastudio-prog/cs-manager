import { Bot } from "./Bot";
import { BuyStrategy } from "./types";
import { BuyLogic } from "./BuyLogic";
import { ECONOMY, WEAPONS, TeamSide, WeaponType, EQUIPMENT_COSTS } from "./constants";
import { WeaponUtils } from "./WeaponUtils";
import { PlayerInventory } from "@/types";

export class TeamEconomyManager {

  /**
   * Executes the team buy strategy.
   * Modifies the inventory of the bots directly.
   */
  public static executeTeamBuy(bots: Bot[], strategy: BuyStrategy, side: TeamSide, overrides: Record<string, BuyStrategy> = {}) {
    // 1. Process Individual Buys
    bots.forEach(bot => {
        const botStrategy = overrides[bot.id] || strategy;
        BuyLogic.processBuy(bot.player.inventory!, side, bot.roundRole, botStrategy);
    });

    // 2. Handle Gifting (Only on FULL Buy)
    // We only trigger gifting if the TEAM STRATEGY is FULL, or if majority are FULL?
    // Let's stick to Team Strategy triggering the gifting phase, but maybe we should allow it if individuals are buying FULL?
    // For now, simple logic: If the global intent is FULL, we gift.
    // If a specific player is forcing/ecoing in a full buy, they won't donate (BuyLogic handles money check) or receive (BuyLogic might give them a bad gun).
    // Actually, simulateGifting checks if receiver has bad gun (< Tier 3).
    // If an ECO player has a pistol, they are a candidate for a drop. This is correct.
    if (strategy === "FULL") {
        // Map to inventory objects to reuse logic
        const inventories = bots.map(b => b.player.inventory!);
        this.simulateGifting(inventories, side);
    }
  }

  /**
   * Calculates the projected total bank and minimum next round cash
   * assuming the given strategy is executed and the round is LOST.
   */
  public static calculateEconomyStats(bots: Bot[], side: TeamSide, strategy: BuyStrategy, currentLossBonusCount: number, overrides: Record<string, BuyStrategy> = {}) {
     let currentTotal = 0;
     let nextRoundMinTotal = 0;

     // 1. Create Dummy Inventories
     const dummies: PlayerInventory[] = bots.map(b => {
         currentTotal += (b.player.inventory?.money || 0);
         return JSON.parse(JSON.stringify(b.player.inventory));
     });

     // 2. Simulate Individual Buys
     dummies.forEach((inv, index) => {
         const botId = bots[index].id;
         const role = bots[index].roundRole;
         const botStrategy = overrides[botId] || strategy;
         BuyLogic.processBuy(inv, side, role, botStrategy);
     });

     // 3. Simulate Gifting
     if (strategy === "FULL") {
         this.simulateGifting(dummies, side);
     }

     // 4. Calculate Results
     const nextLossBonusLevel = Math.min(4, currentLossBonusCount + 1);
     const income = ECONOMY.LOSS_BONUS_START + (nextLossBonusLevel * ECONOMY.LOSS_BONUS_INCREMENT);

     let finalTotal = 0;
     dummies.forEach(inv => {
         finalTotal += inv.money;
         nextRoundMinTotal += (inv.money + income);
     });

     const estimatedSpend = currentTotal - finalTotal;

     return {
         totalBank: currentTotal,
         estimatedSpend: estimatedSpend,
         minNextRound: nextRoundMinTotal
     };
  }

  // Shared Logic for Real and Simulation
  private static simulateGifting(inventories: PlayerInventory[], side: TeamSide) {
      const neededWeapon = side === TeamSide.T ? "ak-47" : "m4a1-s";
      const cost = WEAPONS[neededWeapon].cost;

      // Identify Receivers
      const receivers = inventories.filter(inv => {
          if (!inv.primaryWeapon) return true;
          const weapon = WEAPONS[inv.primaryWeapon];
          const tier = WeaponUtils.getWeaponTier(weapon.type);
          return tier < 3;
      });

      // Identify Donors
      const donors = inventories.filter(inv => {
          return inv.money >= cost &&
                 inv.primaryWeapon &&
                 WeaponUtils.getWeaponTier(WEAPONS[inv.primaryWeapon].type) >= 3;
      });

      // Sort Donors by Wealth (Descending)
      donors.sort((a, b) => b.money - a.money);

      receivers.forEach(receiver => {
          if (donors.length === 0) return;

          // Find first capable donor
          // Since we might have modified donors in previous iteration, we re-check condition
          // But since we sort once, the order implies priority.
          // However, a donor might drop multiple times.

          // We need to re-sort or find the richest capable donor each time?
          // Or just iterate the list.
          // Let's just iterate the sorted list.

          const donor = donors.find(d => d.money >= cost);

          if (donor) {
              donor.money -= cost;
              receiver.primaryWeapon = neededWeapon;
              // No need to remove donor, they might drop again if rich enough.
              // Re-sorting isn't strictly necessary if we just want "someone" to drop,
              // but "wealthiest" implies we should always pick max.
              // Since we decrement money, the list might need resort if strict.
              // Optimization: Just re-sort or linear scan. Donors list is small (max 5).
              donors.sort((a, b) => b.money - a.money);
          }
      });
  }
}
