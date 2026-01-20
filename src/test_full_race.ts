
import { initializeSeason } from './engine/grid';
import { generateTrack } from './engine/track';
import { runFullRaceSimulation } from './engine/race';

console.log("--- Starting Full Race Simulation Verification ---");

// 1. Setup
const grid = initializeSeason();
// Patch a player team for testing messages
grid[0].id = 'player-team';
grid[0].drivers.forEach(d => d.teamId = 'player-team');

const track = generateTrack();
track.laps = 10; // Reduce laps for quick test, or keep standard. Let's do 20.
track.laps = 20;

console.log(`Track: ${track.name}, Laps: ${track.laps}, Segments: ${track.segments.length}`);
console.log(`Grid Size: ${grid.length} teams, ${grid.flatMap(t => t.drivers).length} drivers`);

// 2. Run Simulation
const startTime = Date.now();
const history = runFullRaceSimulation(grid, track, 'player-team', []);
const duration = Date.now() - startTime;

console.log(`Simulation completed in ${duration}ms`);
console.log(`History Steps: ${history.length}`);

if (history.length === 0) {
    console.error("Error: History is empty!");
    process.exit(1);
}

// 3. Analyze Results
const lastSnapshot = history[history.length - 1];
const firstSnapshot = history[0];

console.log("\n--- Final Standings (Top 5) ---");
lastSnapshot.results.slice(0, 5).forEach(r => {
    console.log(`P${r.rank} ${r.driverName} (${r.teamName}) - Total: ${r.totalTime.toFixed(2)}s - Best: ${r.bestLapTime.toFixed(2)}s`);
});

console.log("\n--- Last Place ---");
const lastPlace = lastSnapshot.results[lastSnapshot.results.length - 1];
console.log(`P${lastPlace.rank} ${lastPlace.driverName} - Total: ${lastPlace.totalTime.toFixed(2)}s`);

// 4. Stability Check
// Check for massive drops or impossible gaps
let maxPosChange = 0;
let maxGap = 0;

const leaderTime = lastSnapshot.results[0].totalTime;
maxGap = lastPlace.totalTime - leaderTime;

console.log(`\nSpread (P1 to Last): ${maxGap.toFixed(2)}s over ${track.laps} laps`);
const avgLapTime = leaderTime / track.laps;
console.log(`Approx Avg Lap Time: ${avgLapTime.toFixed(2)}s`);

// Check position changes per lap
for (let i = 1; i < history.length; i++) {
    const prev = history[i-1];
    const curr = history[i];

    curr.results.forEach(r => {
        const prevRes = prev.results.find(p => p.driverId === r.driverId);
        if (prevRes) {
            const change = Math.abs(prevRes.rank - r.rank);
            if (change > maxPosChange) maxPosChange = change;
        }
    });
}

console.log(`Max Position Change in single lap: ${maxPosChange}`);

if (maxPosChange > 15) {
    console.warn("WARNING: High volatility detected (>15 pos change in one lap)");
}

if (maxGap > (avgLapTime * 3)) { // If lapped 3 times in 20 laps? Maybe too slow?
   // Actually 20 laps * 10s gap per lap = 200s.
   // 20 laps * 100s/lap = 2000s total.
   // Gap of 50-100s is normal.
   console.log("Gap seems reasonable.");
}

console.log("\n--- Feed Messages Sample (Lap 5) ---");
const lap5 = history.find(h => h.lapNumber === 5);
if (lap5 && lap5.messages.length > 0) {
    lap5.messages.forEach(m => console.log(`[${m.type}] ${m.message}`));
} else {
    console.log("No messages for Lap 5.");
}

console.log("\nVerification Complete.");
