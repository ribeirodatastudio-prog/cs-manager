
import { calculateQualifyingPace } from './engine/race';
import { SEGMENT_TYPES, STAT_NAMES, type SegmentType, type StatName } from './engine/data';
import type { Driver } from './engine/grid';
import type { Track } from './engine/track';

// 1. Setup Mock Data
const mockStats: Record<StatName, number> = {
  Cornering: 50,
  Overtaking: 50,
  Braking: 50,
  Instincts: 50,
  Acceleration: 50,
  Consistency: 50,
  Pace: 50,
};

const mockDriver: Driver = {
  id: 'bench-driver',
  name: 'Bench Driver',
  teamId: 'bench-team',
  stats: mockStats,
  totalStats: 350,
  championshipPoints: 0,
};

const mockSegments: SegmentType[] = [
  SEGMENT_TYPES.LONG_STRAIGHT,
  SEGMENT_TYPES.LOW_SPEED_CORNER,
  SEGMENT_TYPES.MEDIUM_SPEED_CORNER,
  SEGMENT_TYPES.HIGH_SPEED_CORNER,
  SEGMENT_TYPES.SHORT_STRAIGHT,
  SEGMENT_TYPES.MEDIUM_STRAIGHT,
  SEGMENT_TYPES.LONG_STRAIGHT,
  SEGMENT_TYPES.LOW_SPEED_CORNER,
  SEGMENT_TYPES.MEDIUM_SPEED_CORNER,
  SEGMENT_TYPES.HIGH_SPEED_CORNER,
  SEGMENT_TYPES.SHORT_STRAIGHT,
  SEGMENT_TYPES.MEDIUM_STRAIGHT,
  SEGMENT_TYPES.LONG_STRAIGHT,
  SEGMENT_TYPES.LOW_SPEED_CORNER,
  SEGMENT_TYPES.MEDIUM_SPEED_CORNER,
  SEGMENT_TYPES.HIGH_SPEED_CORNER,
  SEGMENT_TYPES.SHORT_STRAIGHT,
  SEGMENT_TYPES.MEDIUM_STRAIGHT,
  SEGMENT_TYPES.LONG_STRAIGHT,
];

const mockTrack: Track = {
  id: 'bench-track',
  name: 'Bench Track',
  segments: mockSegments,
  laps: 50,
  difficulty: 100,
  sector1: 6,
  sector2: 12,
};

// 2. Verification
const result = calculateQualifyingPace(mockDriver, mockTrack);
console.log("Verification Result:", result);

// 3. Benchmark Loop
const ITERATIONS = 100_000;

console.log(`Starting benchmark: ${ITERATIONS} iterations of calculateQualifyingPace...`);

const start = performance.now();

for (let i = 0; i < ITERATIONS; i++) {
  calculateQualifyingPace(mockDriver, mockTrack);
}

const end = performance.now();
const duration = end - start;

console.log(`Total Time: ${duration.toFixed(2)}ms`);
console.log(`Average Time: ${(duration / ITERATIONS).toFixed(4)}ms`);
console.log(`Ops/Sec: ${(1000 / (duration / ITERATIONS)).toFixed(0)}`);
