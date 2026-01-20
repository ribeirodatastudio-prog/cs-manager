import { performance } from 'perf_hooks';

const N = 10000;

console.log(`Generating data for N=${N} drivers...`);

// Mock Data Generation
const drivers = Array.from({ length: N }, (_, i) => ({
    id: `driver-${i}`,
    name: `Driver ${i}`,
    stats: { Instincts: 50 } // Minimal stats
}));

const driverMap = new Map(drivers.map(d => [d.id, d]));

const qualifyingResults = drivers.map((d, i) => ({
    driverId: d.id,
    time: 60 + Math.random() * 10,
    sectors: [20, 20, 20] as [number, number, number]
}));

// Shuffle for findIndex to do some work (simulate unsorted or random access)
// In reality, qualifyingResults is sorted by time, but we look up by ID.
qualifyingResults.sort(() => Math.random() - 0.5);

const results = drivers.map((d, i) => ({
    driverId: d.id,
    totalTime: i * 0.1,
    rank: i + 1,
    status: 'Running'
}));

// currentStandings is sorted by race position
const currentStandings = [...results];

console.log(`Starting Benchmark...`);

// --- NAIVE IMPLEMENTATION (Current) ---
const startNaive = performance.now();

let naiveProcessed = 0;
results.forEach(r => {
    const driver = driverMap.get(r.driverId);
    if (!driver) return;

    // The Bottlenecks:
    // 1. Find qTime (O(N))
    const qTime = qualifyingResults.find(q => q.driverId === r.driverId)?.time || 300;

    // 2. Find standings index (O(N))
    const myIndex = currentStandings.findIndex(s => s.driverId === r.driverId);

    // 3. Find expected rank (O(N))
    const expectedRank = qualifyingResults.findIndex(q => q.driverId === r.driverId) + 1;

    // Mock access to simulate usage
    if (qTime > 0 && myIndex >= 0 && expectedRank >= 0) {
        naiveProcessed++;
    }
});

const endNaive = performance.now();
const naiveTime = endNaive - startNaive;
console.log(`Naive (Current) Time: ${naiveTime.toFixed(2)}ms`);


// --- OPTIMIZED IMPLEMENTATION (Proposed) ---
const startOpt = performance.now();

// Pre-computation step
const qualifyingLookup = new Map<string, { time: number, rank: number }>();
qualifyingResults.forEach((q, index) => {
   qualifyingLookup.set(q.driverId, { time: q.time, rank: index + 1 });
});

const standingsIndexMap = new Map<string, number>();
currentStandings.forEach((s, index) => {
   standingsIndexMap.set(s.driverId, index);
});

let optProcessed = 0;
results.forEach(r => {
    const driver = driverMap.get(r.driverId);
    if (!driver) return;

    // Optimized Lookups (O(1))
    const qData = qualifyingLookup.get(r.driverId);
    const qTime = qData?.time || 300;
    const expectedRank = qData?.rank || 0;

    const myIndex = standingsIndexMap.get(r.driverId);

    // Mock access
    if (qTime > 0 && myIndex !== undefined && expectedRank >= 0) {
        optProcessed++;
    }
});

const endOpt = performance.now();
const optTime = endOpt - startOpt;

console.log(`Optimized Time: ${optTime.toFixed(2)}ms`);
console.log(`Speedup: x${(naiveTime / optTime).toFixed(1)}`);
