import { PlayerInventory } from "@/types";
import { WEAPONS, EQUIPMENT_COSTS, TeamSide, WeaponType } from "./constants";

export class BuyLogic {

  public static processBuy(inventory: PlayerInventory, side: TeamSide, role: string) {
    // Reset temporary round items (nades could be kept but for simplicity reset or check max)
    // We assume inventory persists across rounds, but nades might be used?
    // In this simulation, we'll refill if missing.

    // 1. Determine Buy Strategy
    const money = inventory.money;
    let strategy: "ECO" | "FORCE" | "FULL" = "ECO";

    if (money >= 4000) strategy = "FULL";
    else if (money >= 2000) strategy = "FORCE";
    else strategy = "ECO";

    // 2. Buy Items based on strategy

    // Always try to upgrade pistol if strictly default?
    // Not critical.

    if (strategy === "FULL") {
      this.buyFull(inventory, side, role);
    } else if (strategy === "FORCE") {
      this.buyForce(inventory, side);
    } else {
      this.buyEco(inventory, side);
    }
  }

  private static buyFull(inventory: PlayerInventory, side: TeamSide, role: string) {
    // 1. Armor
    this.buyArmor(inventory, true);

    // 2. Primary Weapon
    // If we already have a primary, keep it (unless we want to drop? For now keep).
    if (!inventory.primaryWeapon) {
      if (role === "AWPer" && inventory.money >= WEAPONS["awp"].cost) {
        this.purchase(inventory, "awp");
      } else {
        // Rifler
        if (side === TeamSide.T) {
          if (inventory.money >= WEAPONS["ak-47"].cost) this.purchase(inventory, "ak-47");
          else if (inventory.money >= WEAPONS["galil_ar"].cost) this.purchase(inventory, "galil_ar");
        } else {
          if (inventory.money >= WEAPONS["m4a1-s"].cost) this.purchase(inventory, "m4a1-s"); // Prefer -S for now
          else if (inventory.money >= WEAPONS["famas"].cost) this.purchase(inventory, "famas");
        }
      }
    }

    // 3. Kit (CT)
    if (side === TeamSide.CT && !inventory.hasKit) {
      if (inventory.money >= EQUIPMENT_COSTS.KIT) {
        inventory.money -= EQUIPMENT_COSTS.KIT;
        inventory.hasKit = true;
      }
    }

    // 4. Utilities (Simple fill)
    this.buyUtility(inventory, side);
  }

  private static buyForce(inventory: PlayerInventory, side: TeamSide) {
    // Armor (Vest only usually, but let's try Helm if affordable)
    this.buyArmor(inventory, true); // Try full armor

    if (!inventory.primaryWeapon) {
      // SMGs or Cheap Rifles
      if (side === TeamSide.T) {
        if (inventory.money >= WEAPONS["galil_ar"].cost) this.purchase(inventory, "galil_ar");
        else if (inventory.money >= WEAPONS["mac-10"].cost) this.purchase(inventory, "mac-10");
        else if (inventory.money >= WEAPONS["tec-9"].cost) this.purchase(inventory, "tec-9"); // Pistol upgrade
      } else {
        if (inventory.money >= WEAPONS["famas"].cost) this.purchase(inventory, "famas");
        else if (inventory.money >= WEAPONS["mp9"].cost) this.purchase(inventory, "mp9");
        else if (inventory.money >= WEAPONS["five-seven"].cost) this.purchase(inventory, "five-seven");
      }
    }

    // Few nades
    if (inventory.money >= EQUIPMENT_COSTS.FLASHBANG) {
       this.purchaseUtility(inventory, "flashbang");
    }
  }

  private static buyEco(inventory: PlayerInventory, side: TeamSide) {
    // Upgrade Pistol if possible
    if (!inventory.secondaryWeapon) {
       if (side === TeamSide.T && inventory.money >= WEAPONS["p250"].cost) this.purchase(inventory, "p250");
       else if (side === TeamSide.CT && inventory.money >= WEAPONS["p250"].cost) this.purchase(inventory, "p250");
    }
    // Maybe a flash
    if (inventory.money > 2000) { // Should save, but if we have excess
       this.purchaseUtility(inventory, "flashbang");
    }
  }

  private static buyArmor(inventory: PlayerInventory, helmet: boolean) {
    if (inventory.hasHelmet) return; // Maxed
    if (inventory.hasKevlar && !helmet) return; // Has vest, doesn't want helmet

    if (inventory.hasKevlar && helmet) {
      // Upgrade
      if (inventory.money >= EQUIPMENT_COSTS.HELMET) {
        inventory.money -= EQUIPMENT_COSTS.HELMET;
        inventory.hasHelmet = true;
      }
    } else {
      // Buy Full or Vest
      const targetCost = helmet ? EQUIPMENT_COSTS.FULL_ARMOR : EQUIPMENT_COSTS.KEVLAR;
      if (inventory.money >= targetCost) {
        inventory.money -= targetCost;
        inventory.hasKevlar = true;
        if (helmet) inventory.hasHelmet = true;
      } else if (inventory.money >= EQUIPMENT_COSTS.KEVLAR) {
        inventory.money -= EQUIPMENT_COSTS.KEVLAR;
        inventory.hasKevlar = true;
      }
    }
  }

  private static purchase(inventory: PlayerInventory, weaponId: string) {
    const weapon = WEAPONS[weaponId];
    if (!weapon) return;

    // Check cost
    if (inventory.money < weapon.cost) return;

    // Deduct
    inventory.money -= weapon.cost;

    // Equip
    if (weapon.type === WeaponType.PISTOL) {
      inventory.secondaryWeapon = weaponId;
    } else {
      inventory.primaryWeapon = weaponId;
    }
  }

  private static buyUtility(inventory: PlayerInventory, side: TeamSide) {
    const utils = ["smoke", "flashbang", "he"];
    if (side === TeamSide.T) utils.push("molotov");
    else utils.push("incendiary");

    utils.forEach(u => this.purchaseUtility(inventory, u));
  }

  private static purchaseUtility(inventory: PlayerInventory, utilName: string) {
    // Simple mapping
    let cost = 0;
    switch(utilName) {
        case "smoke": cost = EQUIPMENT_COSTS.SMOKE; break;
        case "flashbang": cost = EQUIPMENT_COSTS.FLASHBANG; break;
        case "he": cost = EQUIPMENT_COSTS.HE; break;
        case "molotov": cost = EQUIPMENT_COSTS.MOLOTOV; break;
        case "incendiary": cost = EQUIPMENT_COSTS.INCENDIARY; break;
    }

    if (inventory.money >= cost) {
        // Check if already has? (Assume 1 of each for simplicity)
        // inventory.utilities is string[]
        if (!inventory.utilities.includes(utilName)) {
            inventory.money -= cost;
            inventory.utilities.push(utilName);
        }
    }
  }
}
