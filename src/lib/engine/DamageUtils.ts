import { Bot } from "./Bot";
import { Weapon } from "@/types/Weapon";

export type HitGroup = "HEAD" | "CHEST" | "STOMACH" | "LEGS";

export function determineHitGroup(attacker: Bot, distance: number): HitGroup {
  const tech = attacker.player.skills.technical;
  const placement = tech.crosshairPlacement;

  // Close Range Logic (< 400 units)
  if (distance < 400) {
    // High precision forces headshot
    if (tech.firstBulletPrecision > 170) {
      return "HEAD";
    }

    // Weighted Random based on Crosshair Placement
    // Higher placement = Higher Head chance, Lower Leg chance
    const headChance = 0.2 + (placement / 200) * 0.6; // 20% to 80%
    const legChance = Math.max(0, 0.15 - (placement / 200) * 0.15); // 15% to 0%

    // Roll for Head
    if (Math.random() < headChance) return "HEAD";

    // Roll for Legs
    if (Math.random() < legChance) return "LEGS";

    // Remaining: Chest vs Stomach (70/30 split favor Chest)
    return Math.random() < 0.7 ? "CHEST" : "STOMACH";
  }

  // Long Range Logic (Standard)
  // Chance for headshot: 5% base + up to 75% bonus (Max 80% at 200 skill)
  const headChance = 0.05 + (placement / 200) * 0.75;

  if (Math.random() < headChance) return "HEAD";

  // Remaining distribution
  const roll2 = Math.random();
  if (roll2 < 0.6) return "CHEST";
  if (roll2 < 0.85) return "STOMACH";
  return "LEGS";
}

export function calculateDamage(
  weapon: Weapon,
  hitGroup: HitGroup,
  target: Bot,
  distance: number
): { damage: number; armorReduced: boolean } {
  const baseDamage = weapon.damage;
  let finalDamage = baseDamage;
  let armorReduced = false;

  // 0. Apply Damage Falloff
  // Formula: Damage * (1 - Falloff)^(Distance/500)
  const falloff = weapon.damageFalloff ?? 0.1; // Default safe fallback
  const attenuation = Math.pow(1 - falloff, distance / 500);
  finalDamage *= attenuation;

  // Track HS Mult for logging
  let usedHsMult = weapon.hsMultiplier;

  // 1. Hit Group Multiplier
  switch (hitGroup) {
    case "HEAD":
      // Handle "N/A" (0.0) -> Fallback to 4.0
      if (usedHsMult === 0) {
        usedHsMult = 4.0;
      }
      finalDamage *= usedHsMult;
      break;
    case "STOMACH":
      finalDamage *= 1.25;
      break;
    case "LEGS":
      finalDamage *= 0.75;
      break;
    case "CHEST":
    default:
      finalDamage *= 1.0;
      break;
  }

  // 2. Armor Reduction
  // Helmet protects Head
  if (hitGroup === "HEAD") {
    if (target.hasHelmet) {
      finalDamage *= weapon.armorPen;
      armorReduced = true;
    }
  }
  // Vest protects Chest and Stomach
  else if (hitGroup === "CHEST" || hitGroup === "STOMACH") {
    if (target.hasVest) {
      finalDamage *= weapon.armorPen;
      armorReduced = true;
    }
  }
  // Legs are not armored

  // Log Debugging (Optional, can be removed to reduce noise)
  // console.log(`[Debug] Dist: ${distance.toFixed(0)} | Attenuation: ${attenuation.toFixed(2)} | Result: ${finalDamage.toFixed(2)}`);

  // Ensure Minimum Damage of 1 and Round Down
  const resultDamage = Math.max(1, Math.floor(finalDamage));

  return { damage: resultDamage, armorReduced };
}
