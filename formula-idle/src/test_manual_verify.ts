
import { initializeSeason } from './engine/grid';
import { generateTrack } from './engine/track';
import { calculateQualifyingPace, simulateLap } from './engine/race';

console.log("=== Manual Logic Verification ===");

// 1. Season & Grid
console.log("\n1. Initializing Season...");
const grid = initializeSeason();
console.log(`Grid generated with ${grid.length} teams.`);
const team1 = grid[0];
console.log(`Team 1: ${team1.name}, Rank ${team1.rank}, Drivers: ${team1.drivers.length}`);
console.log(`Team 1 Championship Points: ${team1.championshipPoints}`);
console.log(`Driver 1 Championship Points: ${team1.drivers[0].championshipPoints}`);

if (team1.championshipPoints !== 0 || team1.drivers[0].championshipPoints !== 0) {
    console.error("FAIL: Points not initialized to 0");
} else {
    console.log("PASS: Points initialized.");
}

// 2. Track
console.log("\n2. Generating Track...");
const track = generateTrack();
console.log(`Track: ${track.name}, Segments: ${track.segments.length}`);
console.log(`Sectors split at: ${track.sector1} and ${track.sector2}`);

if (!track.sector1 || !track.sector2 || track.sector1 >= track.sector2) {
    console.error("FAIL: Sector indices invalid");
} else {
    console.log("PASS: Sectors defined.");
}

// 3. Qualifying Pace
console.log("\n3. Calculating Qualifying Pace...");
const driver = team1.drivers[0];
const qualyResult = calculateQualifyingPace(driver, track);
console.log(`Total Time: ${qualyResult.totalTime.toFixed(3)}s`);
console.log(`Sectors: ${qualyResult.sectors.map(s => s.toFixed(3)).join(', ')}`);

if (qualyResult.sectors.length !== 3) {
    console.error("FAIL: Sector times missing");
} else {
    console.log("PASS: Qualy sectors calculated.");
}

// 4. Simulate Lap
console.log("\n4. Simulating Lap (Debug Analysis)...");
const lapResult = simulateLap(driver, track, qualyResult.totalTime, null);
console.log(`Lap Time: ${lapResult.lapTime.toFixed(3)}s`);
console.log(`Analysis Segments: ${lapResult.analysis.segments.length}`);
console.log(`First Segment Analysis:`, lapResult.analysis.segments[0]);
console.log(`Analysis Final Time: ${lapResult.analysis.finalTime.toFixed(3)}s`);

if (Math.abs(lapResult.lapTime - lapResult.analysis.finalTime) > 0.001) {
    console.error("FAIL: Analysis final time mismatch");
} else {
    console.log("PASS: Analysis consistent.");
}

if (!lapResult.analysis.segments.length) {
    console.error("FAIL: No segment analysis");
} else {
    console.log("PASS: Segment analysis present.");
}
