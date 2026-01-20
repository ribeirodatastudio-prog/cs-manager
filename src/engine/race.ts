import type { Driver, Car } from './grid';
import type { Track } from './track';
import { BASE_SEGMENT_TIMES, SEGMENT_WEIGHTS, SEGMENT_TYPES, type SegmentType } from './data';
import { randomFloat, getChaosWindow } from './mathUtils';

// Helper to get effective stats (Driver + Car)
const getEffectiveStat = (driver: Driver, car: Car, statName: string): number => {
  // @ts-ignore
  let val = driver.stats[statName] || 0;

  if (!car) return val; // Fallback for tests if car is missing

  switch (statName) {
    case 'Cornering':
    case 'Braking':
    case 'Pace':
      val += car.stats.Aero;
      break;
    case 'Overtaking':
    case 'Acceleration':
      val += car.stats.Engine;
      break;
    case 'Instincts':
      val += car.stats.Engineering;
      break;
    case 'Consistency':
      val += car.stats.Engineering;
      if (val > 100) val = 100;
      break;
  }
  return val;
};

// Calculate the Score for a driver on a specific segment type
const calculateSegmentScore = (driver: Driver, car: Car, segmentType: SegmentType): number => {
  const weights = SEGMENT_WEIGHTS[segmentType];
  let rawScore = 0;

  for (const [stat, weight] of Object.entries(weights)) {
    rawScore += getEffectiveStat(driver, car, stat) * weight;
  }

  // Apply Instincts Multiplier
  const instincts = getEffectiveStat(driver, car, 'Instincts');
  const multiplier = 1 + Math.pow(instincts, 0.6) / 50;

  return rawScore * multiplier;
};

export const calculateQualifyingPace = (driver: Driver, car: Car, track: Track): { totalTime: number; sectors: [number, number, number] } => {
  let s1 = 0;
  let s2 = 0;
  let s3 = 0;

  track.segments.forEach((segmentType, idx) => {
    const baseTime = BASE_SEGMENT_TIMES[segmentType];
    const score = calculateSegmentScore(driver, car, segmentType);

    const safeScore = Math.max(score, 1);
    const ratio = track.difficulty / safeScore;
    const segmentTime = baseTime * Math.pow(ratio, 0.2);

    if (idx < track.sector1) {
      s1 += segmentTime;
    } else if (idx < track.sector2) {
      s2 += segmentTime;
    } else {
      s3 += segmentTime;
    }
  });

  return {
    totalTime: s1 + s2 + s3,
    sectors: [s1, s2, s3]
  };
};

export interface RaceConditions {
  gapToAhead: number; // Seconds
  carAheadInstincts: number;
  currentRank: number;
  expectedRank: number;
}

export interface OvertakeAttempt {
  segmentIndex: number;
  segmentName: string;
  modifier: string;
  result: 'Success' | 'Failed';
  rollDetails: string;
}

export interface LapAnalysis {
  baseTime: number;
  segments: {
    type: string;
    base: number;
    score: number;
    result: number;
  }[];
  modifiers: {
    instincts: number;
    traffic: boolean;
    overtakeAttempts: OvertakeAttempt[];
  };
  variance: number;
  finalTime: number;
}

export const simulateLap = (
  driver: Driver,
  car: Car,
  track: Track,
  _qualyTime: number, // Unused but kept for signature compatibility
  conditions: RaceConditions | null
): { lapTime: number; overtakeSuccess: boolean; analysis: LapAnalysis } => {

  const segmentAnalysis: LapAnalysis['segments'] = [];
  const overtakeAttempts: OvertakeAttempt[] = [];

  // 1. Determine Initial Traffic State
  let isStuck = false;
  if (conditions) {
    const isBehindSchedule = conditions.currentRank > conditions.expectedRank;
    if (isBehindSchedule && conditions.gapToAhead < 3.0) {
      isStuck = true;
    }
  }

  const initialStuckState = isStuck;
  let overtakeSuccess = false;
  let rawLapTime = 0;

  // 2. Iterate Segments
  track.segments.forEach((currentSegment, idx) => {
    // A. Base Calculation
    const baseSegTime = BASE_SEGMENT_TIMES[currentSegment];
    const score = calculateSegmentScore(driver, car, currentSegment);
    const safeScore = Math.max(score, 1);
    const ratio = track.difficulty / safeScore;
    let resultTime = baseSegTime * Math.pow(ratio, 0.2);

    // B. Overtake Logic (Look Ahead)
    if (isStuck) {
      const nextSegment = track.segments[(idx + 1) % track.segments.length];

      let overtakeModifier = 1.0;
      let modifierName = "Standard";

      // Identify Transitions
      if (currentSegment === SEGMENT_TYPES.LONG_STRAIGHT && nextSegment === SEGMENT_TYPES.LOW_SPEED_CORNER) {
        overtakeModifier = 3.0;
        modifierName = "Divebomb (3.0x)";
      } else if (currentSegment === SEGMENT_TYPES.LONG_STRAIGHT && nextSegment === SEGMENT_TYPES.MEDIUM_SPEED_CORNER) {
        overtakeModifier = 1.5;
        modifierName = "Standard Pass (1.5x)";
      } else if (currentSegment === SEGMENT_TYPES.SHORT_STRAIGHT && nextSegment === SEGMENT_TYPES.LOW_SPEED_CORNER) {
        overtakeModifier = 0.5;
        modifierName = "Dirty Air Zone (0.5x)";
      } else {
        modifierName = "Base (1.0x)";
      }

      // Roll for Overtake
      const overtakingStat = getEffectiveStat(driver, car, 'Overtaking');
      const opponentInstincts = conditions?.carAheadInstincts || 50; // Fallback

      const attackRoll = randomFloat(0.8, 1.2);
      const defendRoll = randomFloat(0.8, 1.2);

      const effectiveOvertake = overtakingStat * overtakeModifier;
      const attackScore = effectiveOvertake * attackRoll;
      const defendScore = opponentInstincts * defendRoll;

      const success = attackScore > defendScore;

      overtakeAttempts.push({
        segmentIndex: idx,
        segmentName: `${currentSegment} -> ${nextSegment}`,
        modifier: modifierName,
        result: success ? 'Success' : 'Failed',
        rollDetails: `Att: ${attackScore.toFixed(1)} vs Def: ${defendScore.toFixed(1)}`
      });

      if (success) {
        isStuck = false;
        overtakeSuccess = true;
        // Success means we ignore penalty for THIS segment too?
        // Prompt: "Success: If Roll > 1.0 [sic], the driver passes (ignores Traffic Penalty for this segment)."
        // We assume "Roll > 1.0" meant Success in general.
      } else {
        // Failed: Remain Stuck
        isStuck = true;
      }
    }

    // C. Apply Traffic Penalty
    if (isStuck) {
      resultTime *= 1.15; // 15% penalty per segment while stuck
    }

    rawLapTime += resultTime;

    segmentAnalysis.push({
      type: currentSegment,
      base: baseSegTime,
      score: safeScore,
      result: resultTime
    });
  });

  let lapTime = rawLapTime;

  // 3. Apply Consistency Variance
  const consistency = getEffectiveStat(driver, car, 'Consistency');
  const effectiveChaos = getChaosWindow(consistency);
  const varianceMultiplier = 1 + randomFloat(-effectiveChaos, effectiveChaos);

  const varianceDelta = lapTime * (varianceMultiplier - 1);
  lapTime *= varianceMultiplier;

  const analysis: LapAnalysis = {
    baseTime: rawLapTime, // This is the sum of segments (including traffic penalties before variance)
    segments: segmentAnalysis,
    modifiers: {
      instincts: getEffectiveStat(driver, car, 'Instincts'),
      traffic: initialStuckState, // Was the driver initially stuck?
      overtakeAttempts
    },
    variance: varianceDelta,
    finalTime: lapTime
  };

  return { lapTime, overtakeSuccess, analysis };
};
