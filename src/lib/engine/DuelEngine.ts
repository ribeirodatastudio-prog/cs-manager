import { Bot } from "./Bot";
import { determineHitGroup, calculateDamage } from "./DamageUtils";

export interface ParticipantResult {
  id: string;
  damage: number;
  hits: number;
  timeTaken: number; // in ms, Infinity if no hit
  isHeadshot: boolean;
  bulletsFired: number;
  fired: boolean;
}

export interface DuelResult {
  winnerId: string | null; // ID of who "won" (killed or dealt more damage first), or null
  log: string[];
  publicLog: string[];
  initiator: ParticipantResult;
  target: ParticipantResult;
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
  private static readonly BASE_DIFFICULTY = 100;
  private static readonly BASE_TIME_TO_HIT = 500; // ms
  private static readonly TIME_PER_BULLET = 100; // ms (600 RPM)
  private static readonly ENTRY_FRAG_TIME_REDUCTION = 120; // ms - Peeker tempo advantage
  private static readonly ENTRY_FRAG_ACCURACY_PENALTY = 0.85; // 15% reduction

  public static getDefuseTime(bot: Bot): number {
    if (bot.player.inventory?.hasDefuseKit) {
      return 5000;
    }
    return 10000;
  }

  /**
   * Calculates the outcome of a duel between an initiator (Attacker) and a target (Defender).
   * Returns a structured exchange with results for both participants.
   */
  public static calculateOutcome(initiator: Bot, target: Bot, distance: number, isCrossZone: boolean = false, targetCanFire: boolean = true): DuelResult {
    // Simulate Initiator
    const initiatorResult = this.simulateEngagement(initiator, target, distance, true, isCrossZone);
    if (!isCrossZone) {
      initiatorResult.timeToKill *= 0.95; // 5% faster for initiator close range
    }

    // Simulate Target
    let targetResult: CombatSimulationResult;
    if (targetCanFire) {
         targetResult = this.simulateEngagement(target, initiator, distance, false, isCrossZone);
    } else {
         targetResult = {
             success: false,
             timeToKill: Infinity,
             bulletsFired: 0,
             isHeadshot: false,
             damageDealt: 0,
             log: ["Target cannot return fire (Busy/Engaged)"],
             publicLog: []
         };
    }

    // Determine Winner Logic (for statistical purposes, actual damage is applied by simulator)
    // Winner is usually who kills first, or who deals damage if no kill.
    // Since we don't know HP here (we access bot.hp but simulator handles applying damage),
    // we just determine who was *faster* to hit.

    let winnerId: string | null = null;

    if (initiatorResult.success && targetResult.success) {
      if (initiatorResult.timeToKill < targetResult.timeToKill) {
        winnerId = initiator.id;
      } else {
        winnerId = target.id;
      }
    } else if (initiatorResult.success) {
      winnerId = initiator.id;
    } else if (targetResult.success) {
      winnerId = target.id;
    }

    return {
      winnerId: winnerId,
      log: [...initiatorResult.log, ...targetResult.log],
      publicLog: [...initiatorResult.publicLog, ...targetResult.publicLog],
      initiator: {
        id: initiator.id,
        damage: initiatorResult.damageDealt,
        hits: initiatorResult.success ? 1 : 0, // Simplified count
        timeTaken: initiatorResult.timeToKill,
        isHeadshot: initiatorResult.isHeadshot,
        bulletsFired: initiatorResult.bulletsFired,
        fired: true
      },
      target: {
        id: target.id,
        damage: targetResult.damageDealt,
        hits: targetResult.success ? 1 : 0,
        timeTaken: targetResult.timeToKill,
        isHeadshot: targetResult.isHeadshot,
        bulletsFired: targetResult.bulletsFired,
        fired: targetCanFire
      }
    };
  }

  public static getWinProbability(initiator: Bot, target: Bot, distance: number, iterations: number = 50): { initiatorWinRate: number, targetWinRate: number } {
    let initiatorWins = 0;
    const isCrossZone = distance > 200;

    for (let i = 0; i < iterations; i++) {
      const result = this.calculateOutcome(initiator, target, distance, isCrossZone);
      // Simple win check based on damage > 0 and winnerId
      if (result.winnerId === initiator.id) {
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

    // Modifiers
    let precision = tech.firstBulletPrecision;

    // Entry Frag Fix: Use bot state flag set by simulator
    if (shooter.isEntryFragger) {
        precision *= this.ENTRY_FRAG_ACCURACY_PENALTY;
        log.push(`Entry Frag Penalty applied (-${(1 - this.ENTRY_FRAG_ACCURACY_PENALTY)*100}% Precision)`);
    }

    // Stun Fix: Add delay instead of resetting reaction time
    const reaction = physical.reactionTime;
    const stunPenalty = shooter.stunTimer > 0 ? 150 : 0; // ms delay
    if (shooter.stunTimer > 0) {
        log.push("Stunned! +150ms Reaction Delay.");
    }

    // Difficulty Fix: Clamp difficulty
    // Original: BASE - crosshair + targetPositioning
    const rawDifficulty = this.BASE_DIFFICULTY - tech.crosshairPlacement + targetMental.positioning;
    const difficulty = Math.max(20, Math.min(180, rawDifficulty));

    // Time Factor
    let timeToHit = this.BASE_TIME_TO_HIT - reaction + stunPenalty;

    // Entry Frag Tempo Advantage
    if (shooter.isEntryFragger) {
      timeToHit -= this.ENTRY_FRAG_TIME_REDUCTION;
      log.push(`Entry Fragging tempo bonus applied (-${this.ENTRY_FRAG_TIME_REDUCTION}ms).`);
    }

    timeToHit = Math.max(50, timeToHit);
    const jitter = (Math.random() * 30) - 15;
    timeToHit += jitter;

    // Inaccuracy Setup
    const baseChance = precision / 200;
    let standingInaccuracy = weapon.standingInaccuracy;

    if (distance > weapon.accurateRange) {
        standingInaccuracy *= 2;
        log.push(`Range Penalty: Inaccuracy doubled to ${standingInaccuracy.toFixed(2)}`);
    }

    if (isCrossZone && !weapon.name.includes("(scoped)")) {
         const rangeRatio = distance / Math.max(1, weapon.accurateRange);
         const penaltyMultiplier = 1 + (rangeRatio * 0.8);
         standingInaccuracy *= penaltyMultiplier;
         log.push(`Cross-Zone Penalty: Inaccuracy x${penaltyMultiplier.toFixed(2)}`);
    }

    const weaponPenalty = standingInaccuracy / 100;

    // Calculation
    let successProb = (baseChance * (1 - weaponPenalty)) - (difficulty / 500);
    successProb = Math.max(0.01, Math.min(0.99, successProb));

    log.push(`Tap Prob: ${(successProb * 100).toFixed(1)}%`);

    if (Math.random() < successProb) {
        const hitGroup = determineHitGroup(shooter, distance);
        const dmgResult = calculateDamage(weapon, hitGroup, target, distance);

        const hitMsg = `${shooter.player.name} hit ${target.player.name} in ${hitGroup} with ${weapon.name} for ${dmgResult.damage} damage.`;
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

    const sprayBullets = Math.max(3, Math.floor(5 + (200 - mental.composure) / 10));
    const rpmDelay = (60 / weapon.rpm) * 1000;

    for (let i = 1; i <= sprayBullets; i++) {
        const currentTime = timeToHit + (i * rpmDelay);
        const effectiveRecoil = weapon.recoilAmount * i;
        const sprayPenalty = effectiveRecoil / 100;

        let sprayProb = (baseChance * (1 - sprayPenalty)) - (difficulty / 500);

        if (isCrossZone && !weapon.name.includes("(scoped)")) {
             sprayProb *= 0.8;
        }

        sprayProb = Math.max(0.01, Math.min(0.99, sprayProb));

        if (Math.random() < sprayProb) {
            const hitGroup = determineHitGroup(shooter, distance);
            const dmgResult = calculateDamage(weapon, hitGroup, target, distance);

            const hitMsg = `${shooter.player.name} hit ${target.player.name} in ${hitGroup} with ${weapon.name} for ${dmgResult.damage} damage.`;
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
