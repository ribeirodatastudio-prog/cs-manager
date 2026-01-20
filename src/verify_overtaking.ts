import { simulateLap } from './engine/race';
import type { Driver, Car } from './engine/grid';
import type { Track } from './engine/track';
import { SEGMENT_TYPES } from './engine/data';

// Mock Data
const driver: Driver = {
    id: 'test', name: 'Test Driver', teamId: 't1',
    stats: { Overtaking: 80, Cornering: 50, Braking: 50, Acceleration: 50, Instincts: 50, Consistency: 100, Pace: 50 },
    totalStats: 400, championshipPoints: 0,
    nationality: 'Test', flag: '🏳️'
};

const car: Car = {
    stats: { Engine: 0, Aero: 0, Engineering: 0 },
    totalStats: 0
};

const track: Track = {
    id: 'test-track', name: 'Test Track',
    segments: [
        SEGMENT_TYPES.LONG_STRAIGHT,
        SEGMENT_TYPES.LOW_SPEED_CORNER, // Divebomb (3.0x) - Idx 0 -> 1
        SEGMENT_TYPES.SHORT_STRAIGHT,
        SEGMENT_TYPES.LOW_SPEED_CORNER, // Dirty Air (0.5x) - Idx 2 -> 3
        SEGMENT_TYPES.MEDIUM_STRAIGHT
    ],
    laps: 50, difficulty: 1.0, sector1: 2, sector2: 4
};

const conditions = {
    gapToAhead: 1.0,
    carAheadInstincts: 50,
    currentRank: 2,
    expectedRank: 1
};

console.log("--- Testing Overtake Mechanics ---");
console.log("Initial State: Gap 1.0s (< 3.0), Behind Schedule -> Should be STUCK");

// Run simulation
const result = simulateLap(driver, car, track, 0, conditions);

console.log(`Lap Time: ${result.lapTime.toFixed(3)}s`);
console.log(`Overtake Success: ${result.overtakeSuccess}`);
console.log("Attempts:");
result.analysis.modifiers.overtakeAttempts.forEach(a => {
    console.log(`- Seg ${a.segmentIndex} (${a.segmentName}): ${a.modifier} -> ${a.result} (${a.rollDetails})`);
});

// Verify Logic
const attempts = result.analysis.modifiers.overtakeAttempts;
if (attempts.length === 0) {
    console.error("FAIL: No overtake attempts made despite being stuck.");
} else {
    // Check Modifiers
    const divebomb = attempts.find(a => a.segmentName.includes('LongStraight -> LowSpeedCorner'));
    if (divebomb && divebomb.modifier.includes('3.0x')) {
        console.log("PASS: Divebomb modifier correct.");
    } else if (divebomb) {
        console.error(`FAIL: Divebomb modifier incorrect: ${divebomb.modifier}`);
    } else {
        console.log("INFO: Divebomb segment not reached while stuck (maybe passed earlier? logic says this is Seg 0->1 so it should be first).");
    }

    if (result.overtakeSuccess) {
         console.log("Driver successfully overtook. Checking if attempts stopped after success...");
         const successIdx = attempts.findIndex(a => a.result === 'Success');
         const subsequentAttempts = attempts.slice(successIdx + 1);
         if (subsequentAttempts.length > 0) {
             console.error("FAIL: Attempts continued after success.");
         } else {
             console.log("PASS: Attempts stopped after success.");
         }
    } else {
        console.log("Driver failed all attempts. Checking persistence...");
        const dirtyAir = attempts.find(a => a.segmentName.includes('ShortStraight -> LowSpeedCorner'));
        if (dirtyAir && dirtyAir.modifier.includes('0.5x')) {
             console.log("PASS: Dirty Air modifier correct.");
        } else if (dirtyAir) {
             console.error(`FAIL: Dirty Air modifier incorrect: ${dirtyAir.modifier}`);
        }
    }
}
