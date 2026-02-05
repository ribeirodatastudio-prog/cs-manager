import { Bot } from "./Bot";
import { TechnicalSkills, MentalSkills, PhysicalSkills } from "@/types";
import { determineHitGroup, calculateDamage } from "./DamageUtils";

export interface DuelResult {
  winnerId: string;
  loserId: string;
  damage: number;
  bulletsFired: number;
  timeTaken: number; // in ms
  wasHeadshot: boolean;
  log: string[]; // For debugging/explanation
  publicLog: string[]; // User-facing events
}

interface CombatSimulationResult {
  success: boolean;
  timeToKill: number;
  bulletsFired: number;
  isHeadshot: boolean;
  damageDealt: number;
  log: string[];
  publicLog: string[];
}

export class DuelEngine {
  // Configurable constants
  private static readonly BASE_DIFFICULTY = 100;
  private static readonly BASE_TIME_TO_HIT = 500; // ms
  private static readonly TIME_PER_BULLET = 100; // ms (600 RPM)
  private static readonly ENTRY_FRAG_AGGRESSION_THRESHOLD = 150;
  private static readonly ENTRY_FRAG_TIME_REDUCTION = 100; // ms
  private static readonly MOVEMENT_THRESHOLD_FOR_ACCURACY = 180;
  private static readonly ENTRY_FRAG_ACCURACY_PENALTY = 0.9; // 10% reduction
  private static readonly SPRAY_CONTROL_RECOIL_INCREMENT = 5;

  /**
   * Returns the time required to defuse the bomb (in ms).
   * 10 seconds without kit, 5 seconds with kit.
   */
  public static getDefuseTime(bot: Bot): number {
    if (bot.player.inventory?.hasKit) {
      return 5000;
    }
    return 10000;
  }

  /**
   * Calculates the outcome of a duel between an initiator (Attacker) and a target (Defender).
   */
  public static calculateOutcome(initiator: Bot, target: Bot, distance: number, isCrossZone: boolean = false): DuelResult {
    const initiatorResult = this.simulateEngagement(initiator, target, distance, true, isCrossZone);
    const targetResult = this.simulateEngagement(target, initiator, distance, false, isCrossZone);

    // Determine Winner (Who hits first)
    let winnerId: string;
    let loserId: string;
    let finalResult: CombatSimulationResult;
    let damageToLoser: number;

    // Logic: Fastest hit wins the exchange.
    if (initiatorResult.success && targetResult.success) {
      if (initiatorResult.timeToKill < targetResult.timeToKill) {
        winnerId = initiator.id;
        loserId = target.id;
        finalResult = initiatorResult;
        damageToLoser = initiatorResult.damageDealt;
      } else {
        winnerId = target.id;
        loserId = initiator.id;
        finalResult = targetResult;
        damageToLoser = targetResult.damageDealt;
      }
    } else if (initiatorResult.success) {
      winnerId = initiator.id;
      loserId = target.id;
      finalResult = initiatorResult;
      damageToLoser = initiatorResult.damageDealt;
    } else if (targetResult.success) {
      winnerId = target.id;
      loserId = initiator.id;
      finalResult = targetResult;
      damageToLoser = targetResult.damageDealt;
    } else {
      // Both missed. Default to target (defender advantage) but 0 damage.
      winnerId = target.id;
      loserId = initiator.id;
      finalResult = targetResult;
      damageToLoser = 0;
      finalResult.log.push("Both missed. No damage dealt.");
    }

    return {
      winnerId: winnerId,
      loserId: loserId,
      damage: damageToLoser,
      bulletsFired: finalResult.bulletsFired,
      timeTaken: finalResult.timeToKill,
      wasHeadshot: finalResult.isHeadshot,
      log: [...initiatorResult.log, ...targetResult.log],
      publicLog: [...initiatorResult.publicLog, ...targetResult.publicLog]
    };
  }

  public static getWinProbability(initiator: Bot, target: Bot, distance: number, iterations: number = 50): { initiatorWinRate: number, targetWinRate: number } {
    let initiatorWins = 0;

    for (let i = 0; i < iterations; i++) {
      // For probability, we assume isCrossZone is false or infer it?
      // Ideally we should pass it, but for now let's assume if distance > 100 it's likely cross zone?
      // No, let's keep it simple. Probability is just an estimation.
      // But accurate probability is important for 'expectedKills'.
      // If distance > 200, assume crossZone?
      const isCrossZone = distance > 200;
      const result = this.calculateOutcome(initiator, target, distance, isCrossZone);
      if (result.winnerId === initiator.id && result.damage > 0) {
        initiatorWins++;
      }
    }

    const initiatorWinRate = initiatorWins / iterations;
    return {
      initiatorWinRate,
      targetWinRate: 1 - initiatorWinRate
    };
  }

  private static simulateEngagement(shooter: Bot, target: Bot, distance: number, isInitiator: boolean, isCrossZone: boolean): CombatSimulationResult {
    const log: string[] = [];
    const publicLog: string[] = [];
    const tech = shooter.player.skills.technical;
    const mental = shooter.player.skills.mental;
    const physical = shooter.player.skills.physical;
    const targetMental = target.player.skills.mental;

    const weapon = shooter.getEquippedWeapon();
    if (!weapon) {
         log.push(`${shooter.player.name} has no weapon! Miss.`);
         return { success: false, timeToKill: Infinity, bulletsFired: 0, isHeadshot: false, damageDealt: 0, log, publicLog };
    }

    log.push(`Simulating ${shooter.player.name} vs ${target.player.name} (Dist: ${distance.toFixed(1)}) with ${weapon.name}`);

    // Difficulty Calculation
    const difficulty = this.BASE_DIFFICULTY - tech.crosshairPlacement + targetMental.positioning;
    // log.push(`Difficulty: ${difficulty}`);

    // Time Factor
    let timeToHit = this.BASE_TIME_TO_HIT - physical.reactionTime;
    const isEntryFragging = isInitiator && mental.aggression > this.ENTRY_FRAG_AGGRESSION_THRESHOLD;

    if (isEntryFragging) {
      timeToHit -= this.ENTRY_FRAG_TIME_REDUCTION;
      // log.push(`Entry Fragging bonus applied.`);
    }

    timeToHit = Math.max(50, timeToHit);
    const jitter = (Math.random() * 30) - 15;
    timeToHit += jitter;
    // log.push(`Base TimeToHit: ${timeToHit.toFixed(2)}ms`);

    // Inaccuracy Setup
    const baseChance = tech.firstBulletPrecision / 200;
    let standingInaccuracy = weapon.standingInaccuracy;

    // Range Penalty
    // 1. Existing Range Check (Double inaccuracy if > accurateRange)
    if (distance > weapon.accurateRange) {
        standingInaccuracy *= 2;
        log.push(`Range Penalty: Inaccuracy doubled to ${standingInaccuracy.toFixed(2)} (Dist ${distance.toFixed(1)} > ${weapon.accurateRange})`);
    }

    // 2. Cross-Zone Non-Scoped Penalty
    // Actually, weapons.json has separate entries for "(scoped)". If the bot has "AWP", they are not scoped unless the weapon name is "AWP (scoped)".
    // So simple string check for "(scoped)" covers the state where they are using the scope.
    // However, AWP without scope is inaccurate at range anyway.

    // User Requirement: "check the weapon accurate range, use it's range to further change the penalty"
    if (isCrossZone && !weapon.name.includes("(scoped)")) {
         // Apply additional penalty
         // If distance is significantly larger than accurate range, scale penalty.
         const rangeRatio = distance / Math.max(1, weapon.accurateRange);

         // Penalty factor: 1.0 (no extra) to ...?
         // Example: If ratio is 2 (dist 40, range 20), we add 50% more inaccuracy?
         const penaltyMultiplier = 1 + (rangeRatio * 0.5); // Arbitrary scaling

         standingInaccuracy *= penaltyMultiplier;
         log.push(`Cross-Zone Penalty: Inaccuracy x${penaltyMultiplier.toFixed(2)} (Dist: ${distance.toFixed(1)}, Range: ${weapon.accurateRange}, Scoped: No)`);
    }


    // Tap Check
    // Formula: Final_Success = (Base_Chance * (1 - Inaccuracy/100)) - (Diff / 500)
    const weaponPenalty = standingInaccuracy / 100;
    let successProb = (baseChance * (1 - weaponPenalty)) - (difficulty / 500);

    // Clamp
    successProb = Math.max(0.01, Math.min(0.99, successProb));

    log.push(`Tap Prob: ${(successProb * 100).toFixed(1)}%`);

    if (Math.random() < successProb) {
        // HIT
        const hitGroup = determineHitGroup(shooter, distance);
        const dmgResult = calculateDamage(weapon, hitGroup, target, distance);

        const hitMsg = `${shooter.player.name} hit ${target.player.name} in ${hitGroup} with ${weapon.name} for ${dmgResult.damage} damage (Armor reduced: ${dmgResult.armorReduced ? "Yes" : "No"}).`;
        log.push(hitMsg);
        publicLog.push(hitMsg);

        return {
            success: true,
            timeToKill: timeToHit,
            bulletsFired: 1,
            isHeadshot: hitGroup === "HEAD",
            damageDealt: dmgResult.damage,
            log,
            publicLog
        };
    }

    log.push("Tap Missed. Spraying...");

    // Spray Loop
    const sprayBullets = Math.max(3, Math.floor(5 + (200 - mental.composure) / 10)); // Min 3 bullets
    const rpmDelay = (60 / weapon.rpm) * 1000;

    for (let i = 1; i <= sprayBullets; i++) {
        const currentTime = timeToHit + (i * rpmDelay);

        // Recoil Logic: Inaccuracy replaced by RecoilAmount * index
        const effectiveRecoil = weapon.recoilAmount * i;
        const sprayPenalty = effectiveRecoil / 100;

        // Recalculate Probability
        // Note: keeping difficulty constant.
        let sprayProb = (baseChance * (1 - sprayPenalty)) - (difficulty / 500);

        // Apply Cross-Zone penalty to spray as well? Yes.
        // If cross zone, reduce spray prob?
        if (isCrossZone && !weapon.name.includes("(scoped)")) {
             sprayProb *= 0.8; // Flat 20% reduction on spray control for long range
        }

        sprayProb = Math.max(0.01, Math.min(0.99, sprayProb));

        if (Math.random() < sprayProb) {
            const hitGroup = determineHitGroup(shooter, distance);
            const dmgResult = calculateDamage(weapon, hitGroup, target, distance);

            const hitMsg = `${shooter.player.name} hit ${target.player.name} in ${hitGroup} with ${weapon.name} for ${dmgResult.damage} damage (Armor reduced: ${dmgResult.armorReduced ? "Yes" : "No"}).`;
            log.push(hitMsg);
            publicLog.push(hitMsg);

            return {
                success: true,
                timeToKill: currentTime,
                bulletsFired: 1 + i,
                isHeadshot: hitGroup === "HEAD",
                damageDealt: dmgResult.damage,
                log,
                publicLog
            };
        }
    }

    log.push("Spray Missed.");
    return {
        success: false,
        timeToKill: Infinity,
        bulletsFired: 1 + sprayBullets,
        isHeadshot: false,
        damageDealt: 0,
        log,
        publicLog
    };
  }
}
