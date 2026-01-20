import type { Driver } from './grid';
import type { Track } from './track';
import { BASE_SEGMENT_TIMES, SEGMENT_WEIGHTS, SEGMENT_TYPES, type SegmentType } from './data';
import { randomFloat } from './mathUtils';

// Helper to get stats safely
const getStat = (driver: Driver, statName: string): number => {
  // @ts-ignore
  return driver.stats[statName] || 0;
};

// Calculate the Score for a driver on a specific segment type
const calculateSegmentScore = (driver: Driver, segmentType: SegmentType): number => {
  const weights = SEGMENT_WEIGHTS[segmentType];
  let rawScore = 0;

  for (const [stat, weight] of Object.entries(weights)) {
    rawScore += getStat(driver, stat) * weight;
  }

  // Apply Instincts Multiplier
  const instincts = getStat(driver, 'Instincts');
  const multiplier = 1 + Math.pow(instincts, 0.6) / 50;

  return rawScore * multiplier;
};

export const calculateQualifyingPace = (driver: Driver, track: Track): { totalTime: number; sectors: [number, number, number] } => {
  let s1 = 0;
  let s2 = 0;
  let s3 = 0;

  track.segments.forEach((segmentType, idx) => {
    const baseTime = BASE_SEGMENT_TIMES[segmentType];
    const score = calculateSegmentScore(driver, segmentType);

    const safeScore = Math.max(score, 1);
    const ratio = track.difficulty / safeScore;
    const segmentTime = baseTime * Math.pow(ratio, 0.8);

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
    overtake: string | null;
  };
  variance: number;
  finalTime: number;
}

export const simulateLap = (
  driver: Driver,
  track: Track,
  _qualyTime: number, // Unused but kept for signature compatibility if needed, though we recalc for debug
  conditions: RaceConditions | null
): { lapTime: number; overtakeSuccess: boolean; analysis: LapAnalysis } => {

  // 1. Re-calculate Base Time (Segment by Segment) for Debugging
  let baseTime = 0;
  const segmentAnalysis: LapAnalysis['segments'] = [];

  track.segments.forEach(segmentType => {
    const baseSegTime = BASE_SEGMENT_TIMES[segmentType];
    const score = calculateSegmentScore(driver, segmentType);
    const safeScore = Math.max(score, 1);
    const ratio = track.difficulty / safeScore;
    const resultTime = baseSegTime * Math.pow(ratio, 0.8);

    baseTime += resultTime;

    segmentAnalysis.push({
      type: segmentType,
      base: baseSegTime,
      score: safeScore,
      result: resultTime
    });
  });

  let lapTime = baseTime;

  // 2. Apply Consistency Variance
  const consistency = getStat(driver, 'Consistency');
  const variancePercent = 200 / (consistency + 50);
  const varianceMultiplier = randomFloat(1 - variancePercent / 100, 1 + variancePercent / 100);

  const varianceDelta = lapTime * (varianceMultiplier - 1);
  lapTime *= varianceMultiplier;

  // 3. Overtaking Logic
  let overtakeSuccess = false;
  let isStuck = false;
  let overtakeRoll = null;

  if (conditions) {
    const isBehindSchedule = conditions.currentRank > conditions.expectedRank;

    if (isBehindSchedule && conditions.gapToAhead < 3.0 && conditions.gapToAhead > 0) {
      const overtakingStat = getStat(driver, 'Overtaking');
      const opponentInstincts = conditions.carAheadInstincts;

      let successfulPass = false;

      // Iterate segments to find straights
      for (const segment of track.segments) {
        if (successfulPass) break;

        let weight = 0;
        if (segment === SEGMENT_TYPES.LONG_STRAIGHT) weight = 2.0;
        if (segment === SEGMENT_TYPES.MEDIUM_STRAIGHT) weight = 1.5;
        if (segment === SEGMENT_TYPES.SHORT_STRAIGHT) weight = 1.0;

        if (weight > 0) {
          const attackRoll = randomFloat(0.8, 1.2);
          const defendRoll = randomFloat(0.8, 1.2);
          const attackScore = overtakingStat * weight * attackRoll;
          const defendScore = opponentInstincts * defendRoll;

          if (attackScore > defendScore) {
            successfulPass = true;
            overtakeRoll = `Success (Att: ${attackScore.toFixed(0)} vs Def: ${defendScore.toFixed(0)})`;
          } else {
             // Keep recording the last attempt?
             overtakeRoll = `Failed (Att: ${attackScore.toFixed(0)} vs Def: ${defendScore.toFixed(0)})`;
          }
        }
      }

      if (successfulPass) {
        overtakeSuccess = true;
      } else {
        isStuck = true;
      }
    }
  }

  // 4. Apply Dirty Air Penalty
  if (isStuck) {
    lapTime *= 1.15;
  }

  const analysis: LapAnalysis = {
    baseTime,
    segments: segmentAnalysis,
    modifiers: {
      instincts: getStat(driver, 'Instincts'),
      traffic: isStuck,
      overtake: overtakeRoll
    },
    variance: varianceDelta,
    finalTime: lapTime
  };

  return { lapTime, overtakeSuccess, analysis };
};
