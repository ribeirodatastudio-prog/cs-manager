import type { Driver, Car, Team } from './grid';
import type { Track } from './track';
import { BASE_SEGMENT_TIMES, SEGMENT_WEIGHTS, SEGMENT_TYPES, type SegmentType } from './data';
import { randomFloat, getChaosWindow } from './mathUtils';

// Helper to get effective stats (Driver + Car)
export const getEffectiveStat = (driver: Driver, car: Car, statName: string): number => {
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
export const calculateSegmentScore = (driver: Driver, car: Car, segmentType: SegmentType): number => {
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

// --- New Pre-Calculated Simulation Engine ---

export interface FeedMessage {
  id: string;
  lap: number;
  driverId: string;
  driverName: string;
  type: 'positive' | 'negative' | 'neutral';
  message: string;
  color: string;
}

export interface RaceResultSnapshot {
  driverId: string;
  driverName: string;
  flag: string;
  teamName: string;
  totalTime: number;
  gapToLeader: number;
  gapToAhead: number;
  lapsCompleted: number;
  lastLapTime: number;
  bestLapTime: number;
  rank: number;
  penalty: boolean;
  status: 'Running' | 'Finished';
}

export interface LapSnapshot {
  lapNumber: number;
  results: RaceResultSnapshot[];
  messages: FeedMessage[];
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

export const runFullRaceSimulation = (
    grid: Team[],
    track: Track,
    playerTeamId: string | null = null,
    qualifyingOrder: string[] = []
): LapSnapshot[] => {
  const raceHistory: LapSnapshot[] = [];

  // 1. Flatten Drivers and Initialize State
  // We need to map drivers to teams easily
  const driverTeamMap = new Map<string, Team>();
  const drivers: Driver[] = [];

  grid.forEach(team => {
    team.drivers.forEach(d => {
      driverTeamMap.set(d.id, team);
      drivers.push(d);
    });
  });

  // Calculate Qualifying/Starting Order (assumed to be based on grid array order passed in)
  // We initialize "Current Driver Times" with stagger
  // const currentDriverTimes = new Map<string, number>(); // Unused

  // Use a map to track dynamic state per driver
  interface DriverSimState {
    driver: Driver;
    car: Car;
    totalTime: number;
    lastLapTotalTime: number;
    bestLapTime: number;
    lapsCompleted: number;
    status: 'Running' | 'Finished';
  }

  // Initialize sim state
  let simState: DriverSimState[] = drivers.map((d) => {
    const team = driverTeamMap.get(d.id)!;

    // Determine Start Rank from Qualifying Order
    let startRank = 0;
    if (qualifyingOrder && qualifyingOrder.length > 0) {
        const idx = qualifyingOrder.indexOf(d.id);
        startRank = idx >= 0 ? idx + 1 : 99; // Fallback if not found
    } else {
        // Fallback to driver list order (e.g. for tests)
        startRank = drivers.indexOf(d) + 1;
    }

    const stagger = (startRank - 1) * 0.5;

    return {
      driver: d,
      car: team.car,
      totalTime: stagger,
      lastLapTotalTime: stagger, // Used to calculate lap delta
      bestLapTime: Infinity,
      lapsCompleted: 0,
      status: 'Running'
    };
  });

  // Initial Snapshot (Lap 0 / Grid)
  // We do not push Lap 0 to history necessarily, or maybe as initial state?
  // User asked for "Playback" which usually implies starting from Lap 1 results.
  // But let's create the Lap 0 snapshot for UI initialization if needed, or just handle loop 1..N

  // We will loop from Lap 1 to TotalLaps
  for (let lap = 1; lap <= track.laps; lap++) {

    // Per-Lap State tracking for messages
    const prevRankMap = new Map<string, number>();
    simState.sort((a, b) => a.totalTime - b.totalTime);
    simState.forEach((s, idx) => prevRankMap.set(s.driver.id, idx + 1));

    // Iterate Segments
    track.segments.forEach((currentSegment, segIdx) => {

      // 1. Sort Drivers by physical position on track (Total Time)
      simState.sort((a, b) => a.totalTime - b.totalTime);

      // 2. Iterate Drivers
      for (let i = 0; i < simState.length; i++) {
        const current = simState[i];

        // Skip if finished (though everyone finishes same lap in this model usually, unless lapped logic?
        // For simplicity, we run everyone through all laps. Lapped cars just have higher times.)

        // A. Calculate Base Segment Time
        const baseSegTime = BASE_SEGMENT_TIMES[currentSegment];
        const score = calculateSegmentScore(current.driver, current.car, currentSegment);
        const safeScore = Math.max(score, 1);
        const ratio = track.difficulty / safeScore;
        let resultTime = baseSegTime * Math.pow(ratio, 0.2);

        // B. Proximity Check & Battle Logic
        // let battleModifier = 0; // Added time (penalty) or 0 (success)

        if (i > 0) { // There is a car ahead
          const ahead = simState[i - 1];
          const delta = current.totalTime - ahead.totalTime;

          if (delta < 0.5) {
            // Battle Triggered
            const nextSegment = track.segments[(segIdx + 1) % track.segments.length];

            // Determine Modifier
            let overtakeModifier = 1.0;
            if (currentSegment === SEGMENT_TYPES.LONG_STRAIGHT && nextSegment === SEGMENT_TYPES.LOW_SPEED_CORNER) {
              overtakeModifier = 3.0; // Divebomb
            } else if (currentSegment === SEGMENT_TYPES.LONG_STRAIGHT && nextSegment === SEGMENT_TYPES.MEDIUM_SPEED_CORNER) {
              overtakeModifier = 1.5; // Standard Pass
            } else if (currentSegment === SEGMENT_TYPES.SHORT_STRAIGHT && nextSegment === SEGMENT_TYPES.LOW_SPEED_CORNER) {
              overtakeModifier = 0.5; // Dirty Air Zone
            }

            // Roll for Overtake
            const overtakingStat = getEffectiveStat(current.driver, current.car, 'Overtaking');
            const opponentInstincts = getEffectiveStat(ahead.driver, ahead.car, 'Instincts'); // Use actual ahead stats

            const attackRoll = randomFloat(0.8, 1.2);
            const defendRoll = randomFloat(0.8, 1.2);

            const attackScore = overtakingStat * overtakeModifier * attackRoll;
            const defendScore = opponentInstincts * defendRoll;

            if (attackScore > defendScore) {
              // Success: No penalty.
              // We do not force swap here. The driver simply gets their raw speed.
              // Since 'resultTime' is based on their stats, and presumably they are faster to be catching up,
              // they will likely pass naturally in the sort next segment.
            } else {
              // Fail: Dirty Air Drag
              // +0.1s to +0.3s
              const penalty = randomFloat(0.1, 0.3);
              resultTime += penalty;
            }
          }
        }

        // Add to total time
        current.totalTime += resultTime;
      }
    });

    // End of Lap Logic (Variance & Consistency)
    // We apply consistency variance once per lap to the accumulated Lap Time, or distribute it?
    // The previous model applied it at end of lap. Let's do that.

    simState.forEach(s => {
       const rawLapTime = s.totalTime - s.lastLapTotalTime;

       const consistency = getEffectiveStat(s.driver, s.car, 'Consistency');
       const effectiveChaos = getChaosWindow(consistency);
       const varianceMultiplier = 1 + randomFloat(-effectiveChaos, effectiveChaos);

       const finalLapTime = rawLapTime * varianceMultiplier;
       const varianceDelta = finalLapTime - rawLapTime;

       s.totalTime += varianceDelta; // Adjust total time by the variance
       s.lapsCompleted = lap;

       if (finalLapTime < s.bestLapTime) {
         s.bestLapTime = finalLapTime;
       }

       // Note: lastLapTotalTime for next lap is current totalTime
    });

    // Sort for Snapshot
    simState.sort((a, b) => a.totalTime - b.totalTime);

    // Generate Messages
    const messages: FeedMessage[] = [];
    const leader = simState[0];

    // Filter for player drivers for messages
    const playerDrivers = simState.filter(s => s.driver.teamId === playerTeamId);

    playerDrivers.forEach(pState => {
       const currentRank = simState.indexOf(pState) + 1;
       const startRank = prevRankMap.get(pState.driver.id) || currentRank;
       // const lapTime = pState.totalTime - pState.lastLapTotalTime; // Unused variable

       // Wait, we just updated totalTime. So lapTime is calculated above.
       // Let's recalculate simply:
       const actualLapTime = pState.totalTime - pState.lastLapTotalTime;

       const msgId = `${lap}-${pState.driver.id}`;

       // 1. Mover
       if (currentRank < startRank) {
         messages.push({
           id: msgId, lap, driverId: pState.driver.id, driverName: pState.driver.name,
           type: 'positive', color: 'text-green-400',
           message: `Started P${startRank}, now P${currentRank}. Moving up!`
         });
       }
       // 2. Slider
       else if (currentRank > startRank) {
         messages.push({
           id: msgId, lap, driverId: pState.driver.id, driverName: pState.driver.name,
           type: 'negative', color: 'text-red-400',
           message: `Dropped from P${startRank} to P${currentRank}.`
         });
       }
       // 3. Purple (Best Lap overall) - simplified check against own best for now or check against leader?
       // Let's stick to "Purple Sectors" if it's their PB
       else if (actualLapTime <= pState.bestLapTime && actualLapTime < 300) { // valid time
         messages.push({
             id: msgId, lap, driverId: pState.driver.id, driverName: pState.driver.name,
             type: 'positive', color: 'text-green-400',
             message: `Personal Best lap set: ${actualLapTime.toFixed(3)}s`
         });
       }
    });

    // Create Snapshot
    const results: RaceResultSnapshot[] = simState.map((s, idx) => {
      const ahead = idx > 0 ? simState[idx - 1] : null;
      return {
        driverId: s.driver.id,
        driverName: s.driver.name,
        flag: s.driver.flag || '🏳️',
        teamName: driverTeamMap.get(s.driver.id)?.name || 'Unknown',
        totalTime: s.totalTime,
        gapToLeader: s.totalTime - leader.totalTime,
        gapToAhead: ahead ? s.totalTime - ahead.totalTime : 0,
        lapsCompleted: s.lapsCompleted,
        lastLapTime: s.totalTime - s.lastLapTotalTime,
        bestLapTime: s.bestLapTime,
        rank: idx + 1,
        penalty: false, // Visual only, maybe wire up if penalty occurred?
        status: s.lapsCompleted >= track.laps ? 'Finished' : 'Running'
      };
    });

    raceHistory.push({
      lapNumber: lap,
      results,
      messages
    });

    // Update lastLapTotalTime for next iteration
    simState.forEach(s => {
        s.lastLapTotalTime = s.totalTime;
    });
  }

  return raceHistory;
};
