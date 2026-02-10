
import { MatchSimulator } from '@/lib/engine/MatchSimulator';
import { enhancedNavMeshManager } from '@/lib/engine/EnhancedNavMeshManager';
import { TelemetrySystem } from '@/lib/engine/TelemetrySystem';
import { Player } from '@/types/index';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

// Helper to create a mock player
function createMockPlayer(id: string, name: string, role: string): any {
  return {
    id,
    name,
    age: 20,
    nationality: 'US',
    role,
    skills: {
      technical: {
        shooting: 150,
        crosshairPlacement: 140,
        sprayControl: 130,
        utilityUsage: 120,
        utility: 120,
        firstBulletPrecision: 160,
        movement: 140,
        clutching: 110
      },
      mental: {
        positioning: 150,
        adaptability: 130,
        composure: 140,
        communication: 150,
        gameSense: 145,
        aggression: 100
      },
      physical: {
        reactionTime: 180,
        dexterity: 150,
        consistency: 140,
        injuryResistance: 150
      }
    }
  };
}

async function runProfile() {
    console.log("Loading Navigation Mesh...");

    try {
        const jsonPath = path.join(process.cwd(), 'src/data/de_dust2_web.json');
        const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
        const navData = JSON.parse(jsonContent);

        await enhancedNavMeshManager.loadNavMesh(navData);
        console.log("Navigation Mesh Loaded.");
    } catch (e) {
        console.error("Error loading nav mesh:", e);
        process.exit(1);
    }

    const players: Player[] = [];
    const roles = ['Entry Fragger', 'Support', 'IGL', 'AWPer', 'Lurker'];

    for (let i = 0; i < 10; i++) {
      const team = i < 5 ? 'T' : 'CT';
      const role = roles[i % 5];
      players.push(createMockPlayer(`player_${i}`, `${team}_${role}`, role) as unknown as Player);
    }

    // Initialize Telemetry
    const telemetry = new TelemetrySystem();

    console.log("Initializing MatchSimulator...");
    const startTime = performance.now();

    // Pass callback to log telemetry
    const simulator = new MatchSimulator(players, (state) => {
        telemetry.logTick(state);
    });

    const initTime = performance.now() - startTime;
    console.log(`Initialization took ${initTime.toFixed(2)}ms`);

    simulator.start();
    simulator.applyStrategies(
        "FULL" as any,
        "DEFAULT" as any,
        "FULL" as any,
        "STANDARD" as any,
        {}
    );

    // Override scheduleTick
    // @ts-ignore
    simulator.scheduleTick = () => {};

    const TICKS_TO_RUN = 2000;
    const tickTimes: number[] = [];

    console.log(`Running simulation for ${TICKS_TO_RUN} ticks...`);

    const simStart = performance.now();

    for (let i = 0; i < TICKS_TO_RUN; i++) {
      const tickStart = performance.now();
      simulator.tick();
      const tickEnd = performance.now();
      tickTimes.push(tickEnd - tickStart);
    }

    const simEnd = performance.now();
    const totalTime = simEnd - simStart;
    const avgTickTime = totalTime / TICKS_TO_RUN;
    const maxTickTime = Math.max(...tickTimes);
    const sortedTimes = [...tickTimes].sort((a, b) => a - b);
    const p95TickTime = sortedTimes[Math.floor(sortedTimes.length * 0.95)];

    console.log(`\nResults:`);
    console.log(`Total Time: ${totalTime.toFixed(2)}ms`);
    console.log(`Avg Tick Time: ${avgTickTime.toFixed(4)}ms`);
    console.log(`Max Tick Time: ${maxTickTime.toFixed(4)}ms`);
    console.log(`P95 Tick Time: ${p95TickTime.toFixed(4)}ms`);

    const logContent = `
Profiling Optimized Report
-------------------------
Date: ${new Date().toISOString()}
Ticks: ${TICKS_TO_RUN}
Total Time: ${totalTime.toFixed(2)}ms
Avg Tick Time: ${avgTickTime.toFixed(4)}ms
Max Tick Time: ${maxTickTime.toFixed(4)}ms
P95 Tick Time: ${p95TickTime.toFixed(4)}ms

Distribution:
< 1ms: ${tickTimes.filter(t => t < 1).length}
1-5ms: ${tickTimes.filter(t => t >= 1 && t < 5).length}
5-10ms: ${tickTimes.filter(t => t >= 5 && t < 10).length}
> 10ms: ${tickTimes.filter(t => t >= 10).length}
`;

    const logPath = path.join(process.cwd(), 'logs', 'profiling_optimized.txt');
    fs.writeFileSync(logPath, logContent);
    console.log(`\nReport written to ${logPath}`);

    // Write Telemetry
    const telemetryData = telemetry.getAllRounds();
    // Usually just 1 round in 2000 ticks unless it ended fast.
    const roundLogPath = path.join(process.cwd(), 'logs', `telemetry_round_${telemetryData[0]?.round || 1}.json`);
    fs.writeFileSync(roundLogPath, JSON.stringify(telemetryData[0] || {}, null, 2));
    console.log(`Telemetry written to ${roundLogPath}`);
}

runProfile().catch(console.error);
