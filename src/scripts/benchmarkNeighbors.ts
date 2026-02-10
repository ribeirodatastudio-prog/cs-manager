import { GameMap } from "../lib/engine/GameMap";
import { DUST2_MAP } from "../lib/engine/maps/dust2";

// Suppress console.error for NavMesh auto-load failure
const originalConsoleError = console.error;
console.error = (...args) => {
  // If the error message is related to NavMesh, ignore it
  if (args[0] && typeof args[0] === 'string' && args[0].includes("NavMesh auto-load failed")) {
    return;
  }
  originalConsoleError(...args);
};

async function runBenchmark() {
  console.log("Initializing GameMap with DUST2_MAP...");
  const map = new GameMap(DUST2_MAP);

  // Correctness Check: t_spawn neighbors
  const tSpawnNeighbors = map.getNeighbors("t_spawn");
  const neighborIds = tSpawnNeighbors.map(z => z.id).sort();
  const expectedIds = ["outside_long", "outside_tunnels", "top_mid"].sort(); // Based on DUST2_MAP connections

  if (JSON.stringify(neighborIds) !== JSON.stringify(expectedIds)) {
    console.error("Correctness check failed!");
    console.error("Expected:", expectedIds);
    console.error("Got:", neighborIds);
    process.exit(1);
  } else {
    console.log("Correctness check passed: t_spawn neighbors are correct.");
  }

  // Benchmark
  const ITERATIONS = 100_000; // 1M might be too long if unoptimized, let's start with 100k for faster feedback loop
  const zones = map.getAllZones();
  const zoneIds = zones.map(z => z.id);

  console.log(`Running benchmark: ${ITERATIONS} iterations for ${zoneIds.length} zones...`);

  const start = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    for (const id of zoneIds) {
      map.getNeighbors(id);
    }
  }

  const end = performance.now();
  const duration = end - start;

  console.log(`Benchmark completed in ${duration.toFixed(2)} ms`);
  console.log(`Average time per call: ${(duration / (ITERATIONS * zoneIds.length) * 1e6).toFixed(4)} ns`);
}

runBenchmark().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
