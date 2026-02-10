import { DuelEngine } from "./DuelEngine";
import { Bot } from "./Bot";
import { EventManager } from "./EventManager";
import { TeamSide } from "./TacticsManager";
import { Player } from "@/types";

// Mock Player Data
const createMockPlayer = (id: string, name: string): Player => ({
  id,
  name,
  age: 20,
  nationality: "US",
  role: "Rifler",
  skills: {
    technical: {
      shooting: 150,
      crosshairPlacement: 150,
      sprayControl: 150,
      utilityUsage: 100,
      utility: 100,
      firstBulletPrecision: 150,
      movement: 150,
      clutching: 100,
    },
    mental: {
      positioning: 150,
      adaptability: 100,
      composure: 100,
      communication: 100,
      gameSense: 150,
      aggression: 100,
    },
    physical: {
      reactionTime: 150,
      dexterity: 150,
      consistency: 100,
      injuryResistance: 100,
    },
  },
  inventory: {
    money: 10000,
    primaryWeapon: "ak-47",
    secondaryWeapon: "glock-18",
    hasKevlar: true,
    hasHelmet: true,
    hasDefuseKit: false,
    grenades: [],
  },
});

const runBenchmark = () => {
  const eventManager = new EventManager();
  const player1 = createMockPlayer("p1", "Attacker");
  const player2 = createMockPlayer("p2", "Defender");

  const bot1 = new Bot(player1, TeamSide.T, { x: 0, y: 0 }, "spawn", eventManager);
  const bot2 = new Bot(player2, TeamSide.CT, { x: 500, y: 0 }, "spawn", eventManager);

  // Ensure bot has weapon equipped
  bot1.player.inventory!.primaryWeapon = "ak-47";
  bot2.player.inventory!.primaryWeapon = "m4a1-s";

  const iterations = 100000;
  const distance = 500; // Medium range

  console.log(`Starting benchmark with ${iterations} iterations...`);
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    DuelEngine.calculateOutcome(bot1, bot2, distance, false);
  }

  const endTime = performance.now();
  const duration = endTime - startTime;

  console.log(`Completed in ${duration.toFixed(2)}ms`);
  console.log(`Average time per call: ${(duration / iterations).toFixed(4)}ms`);

  // Verify functionality
  console.log("\nVerifying debug flag...");
  const noDebugResult = DuelEngine.calculateOutcome(bot1, bot2, distance, false, true, undefined, false);
  console.log(`Debug=false log length: ${noDebugResult.log.length}`);

  const debugResult = DuelEngine.calculateOutcome(bot1, bot2, distance, false, true, undefined, true);
  console.log(`Debug=true log length: ${debugResult.log.length}`);
};

runBenchmark();
