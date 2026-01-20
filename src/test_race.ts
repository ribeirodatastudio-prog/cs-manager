import { generateGrid } from './engine/grid';
import { generateTrack } from './engine/track';
import { calculateQualifyingPace, simulateLap } from './engine/race';

const grid = generateGrid();
const track = generateTrack();

const driver1 = grid[0].drivers[0];
const car = grid[0].car;
const q1Result = calculateQualifyingPace(driver1, car, track);
const q1 = q1Result.totalTime;

console.log(`Track: ${track.name} (Segments: ${track.segments.length})`);
console.log(`Base Qualy Time: ${q1.toFixed(3)}s`);

console.log(`\nSimulating Driver 1 Stuck Behind WALL (Instincts 9999):`);
const conditionsWall = {
    gapToAhead: 0.5,
    carAheadInstincts: 9999, // Impossible to pass
    currentRank: 10,
    expectedRank: 1
};

// Check if segments allow overtaking at all (need straights)
const hasStraight = track.segments.some(s => s.includes('Straight'));
if (!hasStraight) {
    console.log("Track has no straights, cannot overtake properly anyway.");
}

const lapStuck = simulateLap(driver1, car, track, q1, conditionsWall);
console.log(`Time: ${lapStuck.lapTime.toFixed(3)}s, Overtake Success: ${lapStuck.overtakeSuccess}`);

if (lapStuck.lapTime > q1 * 1.1) {
    console.log("Penalty Applied Successfully (Time > 1.1x Base)");
} else {
    console.log("Penalty NOT Applied (or variance masked it?)");
}
