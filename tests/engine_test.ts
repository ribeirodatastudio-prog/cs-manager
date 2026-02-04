import { DUST2_MAP } from "../src/lib/engine/maps/dust2";
import { GameMap } from "../src/lib/engine/GameMap";
import { Pathfinder } from "../src/lib/engine/Pathfinder";
import { DuelEngine } from "../src/lib/engine/DuelEngine";
import { Bot } from "../src/lib/engine/Bot";
import { MOCK_PLAYERS } from "../src/lib/mock-players";
import { TeamSide } from "../src/lib/engine/constants";
import { strict as assert } from "assert";

console.log("Running Engine Tests...");

// 1. Map Test
const map = new GameMap(DUST2_MAP);
assert.ok(map.getZone("t_spawn"), "T Spawn should exist");
assert.equal(map.getZone("t_spawn")?.connections.length, 3, "T Spawn should have 3 connections");
console.log("✓ Map Loaded");

// 2. Pathfinder Test
// T Spawn -> Mid Doors
// Path: t_spawn -> top_mid -> mid -> mid_doors
const path = Pathfinder.findPath(map, "t_spawn", "mid_doors");
assert.ok(path, "Path should be found");
console.log("Path found:", path);
// Expected length: 4 nodes? (t_spawn, top_mid, mid, mid_doors)
assert.equal(path?.length, 4, "Path length should be 4");
assert.equal(path?.[0], "t_spawn", "Path start");
assert.equal(path?.[3], "mid_doors", "Path end");
console.log("✓ Pathfinder Logic");

// 3. Duel Test
const p1 = MOCK_PLAYERS[0]; // Zywoo
const p2 = MOCK_PLAYERS[1]; // Karrigan (Lower skill)
const bot1 = new Bot(p1, TeamSide.T, "mid");
const bot2 = new Bot(p2, TeamSide.CT, "mid");
// DuelEngine doesn't use zone for cover in calculation anymore in this version, but that's fine.

// Run 100 duels, Zywoo should win most
let wins1 = 0;
for (let i = 0; i < 100; i++) {
  const res = DuelEngine.calculateOutcome(bot1, bot2);
  if (res.winnerId === bot1.id) wins1++;
}
console.log(`ZywOo wins: ${wins1}/100`);
assert.ok(wins1 > 50, "ZywOo should win majority of duels");
console.log("✓ Duel System");

console.log("All Engine Tests Passed.");
