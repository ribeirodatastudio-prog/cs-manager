import { SEGMENT_TYPES, type SegmentType } from './data';
import { randomInt, randomFloat, clamp } from './mathUtils';

export interface Track {
  id: string;
  name: string;
  segments: SegmentType[];
  laps: number;
  difficulty: number; // 0.5 to 1.5
  sector1: number; // Index where sector 1 ends (exclusive)
  sector2: number; // Index where sector 2 ends (exclusive)
}

const TRACK_NAMES = [
  "Monza Park", "Silverstone Circuit", "Spa Francorchamps", "Suzuka International",
  "Interlagos", "Circuit of the Americas", "Marina Bay", "Monte Carlo",
  "Red Bull Ring", "Zandvoort", "Hungaroring", "Imola", "Catalunya"
];

export const generateTrack = (): Track => {
  const numSegments = randomInt(13, 28);
  const segments: SegmentType[] = [];

  const types = Object.values(SEGMENT_TYPES);

  // Generate random segments
  for (let i = 0; i < numSegments; i++) {
    const type = types[randomInt(0, types.length - 1)];
    segments.push(type);
  }

  // Ensure at least one Long Straight
  const hasLongStraight = segments.includes(SEGMENT_TYPES.LONG_STRAIGHT);
  if (!hasLongStraight) {
    // Replace a random segment with a Long Straight
    const idx = randomInt(0, numSegments - 1);
    segments[idx] = SEGMENT_TYPES.LONG_STRAIGHT;
  }

  // Calculate Laps: Clamp(Round(1000 / Segments), 50, 80)
  const calculatedLaps = Math.round(1000 / numSegments);
  const laps = clamp(calculatedLaps, 50, 80);

  // Difficulty: 0.5 to 1.5
  const difficulty = 200 * randomFloat(0.5, 1.5);

  const name = TRACK_NAMES[randomInt(0, TRACK_NAMES.length - 1)];

  const sector1 = Math.floor(segments.length / 3);
  const sector2 = Math.floor((segments.length * 2) / 3);

  return {
    id: `track-${Date.now()}`,
    name,
    segments,
    laps,
    difficulty,
    sector1,
    sector2
  };
};
