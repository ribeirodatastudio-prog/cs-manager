import { generateTrack } from './engine/track';
import { calculateQualifyingPace } from './engine/race';
import { formatTime } from './engine/mathUtils';
import { STAT_NAMES } from './engine/data';

// Mock driver creation to avoid dependency on grid generation randomization if we want specific stats.
// But we want to test "Rank 1" vs "Rank 40" as the game generates them.
// So we should replicate how grid generation makes stats.
// We can't import `generateGrid` easily if it relies on context or something, but let's check.
// `src/engine/grid.ts` seems pure.

import { generateGrid } from './engine/grid';

const grid = generateGrid();
const track = generateTrack();

// Sort grid by overall potential (sum of stats?) or just take P1 vs P-Last based on Rank index?
// In `generateGrid`, drivers are created for teams. Teams are ranked 1 to 20.
// Team 1 (Rank 1) should have best stats. Team 20 (Rank 20) worst.
// Let's grab Driver 1 from Team 1, and Driver 1 from Team 20.

const team1 = grid.find(t => t.id.includes('team-1')); // generateGrid ids are likely predictable or just use index 0.
// Actually generateGrid might not return sorted array?
// Let's assume index 0 is best team, index 19 is worst.
// Let's verify stats sum to be sure.

const bestTeam = grid[0];
const worstTeam = grid[grid.length - 1];

const bestDriver = bestTeam.drivers[0];
const worstDriver = worstTeam.drivers[0];

const getStatSum = (d: any) => STAT_NAMES.reduce((acc, stat) => acc + (d.stats[stat] || 0), 0);

console.log("=== Calibration Verification ===");
console.log(`Track: ${track.name} (${track.laps} laps, Difficulty: ${track.difficulty.toFixed(1)})`);
console.log(`Segments: ${track.segments.length}`);
console.log(`Length estimate: ~${(track.segments.length * 20)}s (very rough)`);

console.log("\n--- Contenders ---");
console.log(`Best Car (Team ${bestTeam.name}): Stats Sum ~${getStatSum(bestDriver)}`);
console.log(`Worst Car (Team ${worstTeam.name}): Stats Sum ~${getStatSum(worstDriver)}`);

console.log("\n--- Qualifying Pace ---");
const p1Pace = calculateQualifyingPace(bestDriver, track);
const lastPace = calculateQualifyingPace(worstDriver, track);

console.log(`P1 Time:   ${formatTime(p1Pace.totalTime)}`);
console.log(`Last Time: ${formatTime(lastPace.totalTime)}`);

const gap = lastPace.totalTime - p1Pace.totalTime;
const percentage = (lastPace.totalTime / p1Pace.totalTime) * 100;

console.log(`Gap:       +${formatTime(gap)}`);
console.log(`% Slower:  ${percentage.toFixed(1)}%`);

// Also verify segment times logic roughly
// console.log("Debug Segment 0 for P1:", p1Pace.sectors);
