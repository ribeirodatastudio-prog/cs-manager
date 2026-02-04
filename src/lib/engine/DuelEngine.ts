import { Bot } from "./Bot";
import { TechnicalSkills, MentalSkills, PhysicalSkills } from "@/types";

export interface DuelResult {
  winnerId: string;
  loserId: string;
  damage: number;
  bulletsFired: number;
  timeTaken: number; // in ms
  wasHeadshot: boolean;
  log: string[]; // For debugging/explanation
}

interface CombatSimulationResult {
  success: boolean;
  timeToKill: number;
  bulletsFired: number;
  isHeadshot: boolean;
  log: string[];
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
   * Both sides simulate their shooting sequence simultaneously. The one with the lower Time To Kill (TTK) wins.
   *
   * @param initiator The bot initiating the duel (peeking/entering).
   * @param target The bot defending/holding.
   */
  public static calculateOutcome(initiator: Bot, target: Bot): DuelResult {
    const initiatorResult = this.simulateEngagement(initiator, target, true);
    const targetResult = this.simulateEngagement(target, initiator, false);

    // Determine Winner
    let winnerId: string;
    let loserId: string;
    let finalResult: CombatSimulationResult;

    // Logic: Fastest kill wins.
    if (initiatorResult.success && targetResult.success) {
      if (initiatorResult.timeToKill < targetResult.timeToKill) {
        winnerId = initiator.id;
        loserId = target.id;
        finalResult = initiatorResult;
      } else {
        winnerId = target.id;
        loserId = initiator.id;
        finalResult = targetResult;
      }
    } else if (initiatorResult.success) {
      winnerId = initiator.id;
      loserId = target.id;
      finalResult = initiatorResult;
    } else if (targetResult.success) {
      winnerId = target.id;
      loserId = initiator.id;
      finalResult = targetResult;
    } else {
      // Both missed. Default to target (defender advantage)
      winnerId = target.id;
      loserId = initiator.id;
      finalResult = targetResult;
      finalResult.log.push("Both missed. Defaulting to defender win.");
    }

    return {
      winnerId: winnerId,
      loserId: loserId,
      damage: 100, // Fatal damage for now
      bulletsFired: finalResult.bulletsFired,
      timeTaken: finalResult.timeToKill,
      wasHeadshot: finalResult.isHeadshot,
      log: [...initiatorResult.log, ...targetResult.log]
    };
  }

  /**
   * Runs the duel simulation multiple times to determine the statistical win probability.
   * Useful for "Expected Kills" analysis.
   */
  public static getWinProbability(initiator: Bot, target: Bot, iterations: number = 50): { initiatorWinRate: number, targetWinRate: number } {
    let initiatorWins = 0;

    for (let i = 0; i < iterations; i++) {
      // We assume initiator is always the one passed as first arg for consistency in the loop
      const result = this.calculateOutcome(initiator, target);
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

  /**
   * Simulates the shooting sequence for one shooter against a target.
   * @param shooter The bot shooting.
   * @param target The bot being shot at.
   * @param isInitiator Whether the shooter is the one initiating (Entrying).
   */
  private static simulateEngagement(shooter: Bot, target: Bot, isInitiator: boolean): CombatSimulationResult {
    const log: string[] = [];
    const tech = shooter.player.skills.technical;
    const mental = shooter.player.skills.mental;
    const physical = shooter.player.skills.physical;
    const targetMental = target.player.skills.mental;

    log.push(`Simulating ${shooter.player.name} vs ${target.player.name} (Is Initiator: ${isInitiator})`);

    // 1. Difficulty Calculation
    // BaseDifficulty (100) - Attacker crosshairPlacement + Defender positioning.
    let difficulty = this.BASE_DIFFICULTY - tech.crosshairPlacement + targetMental.positioning;

    log.push(`Difficulty: ${difficulty} (100 - ${tech.crosshairPlacement} + ${targetMental.positioning})`);

    // 2. The Time Factor
    // Calculate timeToHit. High reactionTime reduces this.
    // Formula: Base - reactionTime.
    let timeToHit = this.BASE_TIME_TO_HIT - physical.reactionTime;

    // Entry Fragging Adjustments
    const isEntryFragging = isInitiator && mental.aggression > this.ENTRY_FRAG_AGGRESSION_THRESHOLD;
    let accuracyMultiplier = 1.0;

    if (isEntryFragging) {
      timeToHit -= this.ENTRY_FRAG_TIME_REDUCTION;
      log.push(`Entry Fragging: timeToHit reduced by ${this.ENTRY_FRAG_TIME_REDUCTION}`);

      // Accuracy penalty unless movement is high
      if (tech.movement <= this.MOVEMENT_THRESHOLD_FOR_ACCURACY) {
        accuracyMultiplier = this.ENTRY_FRAG_ACCURACY_PENALTY;
        log.push(`Entry Fragging: Movement ${tech.movement} <= ${this.MOVEMENT_THRESHOLD_FOR_ACCURACY}. Accuracy penalty applied.`);
      } else {
        log.push(`Entry Fragging: Movement ${tech.movement} > ${this.MOVEMENT_THRESHOLD_FOR_ACCURACY}. No accuracy penalty.`);
      }
    }

    // Ensure timeToHit is positive
    timeToHit = Math.max(50, timeToHit);

    // Add random jitter to timeToHit to represent human inconsistency (+/- 15ms)
    const jitter = (Math.random() * 30) - 15;
    timeToHit += jitter;

    log.push(`Final timeToHit: ${timeToHit.toFixed(2)}ms (incl. ${jitter.toFixed(2)}ms jitter)`);

    // Mental Overlays
    // pressureFactor = composure / 200.
    const pressureFactor = mental.composure / 200;
    log.push(`Pressure Factor: ${pressureFactor.toFixed(2)} (Composure ${mental.composure})`);

    // 3. The Shooting Sequence

    // Check 1: The Tap
    // Use firstBulletPrecision. If Success > Difficulty, the duel ends (Kill).
    // Logic: Calculate an effective precision score based on skill, pressure, and RNG.
    // Applying accuracyMultiplier here.
    const effectivePrecision = tech.firstBulletPrecision * accuracyMultiplier * pressureFactor;

    // "Success" calculation. We add randomness to allow for variation.
    // Let's say Success = EffectivePrecision + Random(-20% to +20% of Skill) ?
    // Or just a flat random roll 0-200 added?
    // Requirement: "If Success > Difficulty".
    // Let's define Success as: EffectivePrecision + (Math.random() * 100).
    // This gives a variance.
    const variance = Math.random() * 50; // 0-50 random bonus
    const tapSuccessScore = effectivePrecision + variance;

    log.push(`Tap Check: Score ${tapSuccessScore.toFixed(2)} (EffPrec ${effectivePrecision.toFixed(2)} + Rnd ${variance.toFixed(2)}) vs Difficulty ${difficulty}`);

    if (tapSuccessScore > difficulty) {
      log.push("Tap Hit! (Headshot)");
      return {
        success: true,
        timeToKill: timeToHit,
        bulletsFired: 1,
        isHeadshot: true,
        log
      };
    }

    log.push("Tap Missed. Starting Spray.");

    // Check 2: The Spray
    // Loop for x "bullets". x is calculated from composure.
    // Formula: 5 + (200 - composure) / 10.
    // Example: Composure 100 -> 5 + 10 = 15 bullets.
    const sprayBullets = Math.floor(5 + (200 - mental.composure) / 10);

    for (let i = 1; i <= sprayBullets; i++) {
      // Each bullet uses sprayControl vs rising recoilPenalty.
      const bulletRecoil = i * this.SPRAY_CONTROL_RECOIL_INCREMENT;

      // Calculate Spray Score
      const effectiveSprayControl = tech.sprayControl * pressureFactor;
      const sprayScore = effectiveSprayControl - bulletRecoil + (Math.random() * 50); // Add some variance

      // Compare vs Difficulty
      // We use the same Difficulty? Usually spraying is less accurate, but we have recoil penalty subtracting.
      // So checking vs same Difficulty works.

      if (sprayScore > difficulty) {
        const timeTaken = timeToHit + (i * this.TIME_PER_BULLET);
        log.push(`Spray Hit on bullet ${i + 1}! Score ${sprayScore.toFixed(2)} vs Diff ${difficulty}`);
        return {
          success: true,
          timeToKill: timeTaken,
          bulletsFired: 1 + i, // Tap + Spray bullets
          isHeadshot: false,
          log
        };
      }
    }

    log.push(`Spray Finished (Missed all ${sprayBullets} bullets).`);
    return {
      success: false,
      timeToKill: Infinity,
      bulletsFired: 1 + sprayBullets,
      isHeadshot: false,
      log
    };
  }
}
