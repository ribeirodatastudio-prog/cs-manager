// Constants for the Game Economy and Simulation

export const STAT_NAMES = [
  'Cornering',
  'Overtaking',
  'Braking',
  'Instincts',
  'Acceleration',
  'Consistency',
  'Pace'
] as const;

export type StatName = typeof STAT_NAMES[number];

export const CAR_STAT_NAMES = [
  'Engine',
  'Aero',
  'Engineering'
] as const;

export type CarStatName = typeof CAR_STAT_NAMES[number];

export const ECONOMY = {
  BASE_COST: 10,
  COST_EXPONENT: 1.10,
  CAR_BASE_COST: 10,
  CAR_COST_EXPONENT: 1.15,
};

export const GRID = {
  TOTAL_TEAMS: 20,
  DRIVERS_PER_TEAM: 2,
  TIER_1_MAX_STATS: 60,
  TIER_1_MIN_STATS: 20,
  DISTRIBUTION_FACTOR: 2.5, // Tune this for the curve
};

export const SEGMENT_TYPES = {
  LOW_SPEED_CORNER: 'LowSpeedCorner',
  MEDIUM_SPEED_CORNER: 'MediumSpeedCorner',
  HIGH_SPEED_CORNER: 'HighSpeedCorner',
  SHORT_STRAIGHT: 'ShortStraight',
  MEDIUM_STRAIGHT: 'MediumStraight',
  LONG_STRAIGHT: 'LongStraight',
} as const;

export type SegmentType = typeof SEGMENT_TYPES[keyof typeof SEGMENT_TYPES];

export const BASE_SEGMENT_TIMES: Record<SegmentType, number> = {
  [SEGMENT_TYPES.LOW_SPEED_CORNER]: 35.0,
  [SEGMENT_TYPES.MEDIUM_SPEED_CORNER]: 25.0,
  [SEGMENT_TYPES.HIGH_SPEED_CORNER]: 15.0,
  [SEGMENT_TYPES.SHORT_STRAIGHT]: 10.0,
  [SEGMENT_TYPES.MEDIUM_STRAIGHT]: 20.0,
  [SEGMENT_TYPES.LONG_STRAIGHT]: 45.0,
};

// Weights: [Braking, Accel, Cornering, Pace]
// Note: Instincts, Overtaking, Consistency are special stats.
// Here we define the weights for the physical stats.
export const SEGMENT_WEIGHTS: Record<SegmentType, Record<string, number>> = {
  [SEGMENT_TYPES.LOW_SPEED_CORNER]: { Braking: 0.4, Acceleration: 0.4, Cornering: 0.2 },
  [SEGMENT_TYPES.MEDIUM_SPEED_CORNER]: { Braking: 0.33, Acceleration: 0.33, Cornering: 0.34 },
  [SEGMENT_TYPES.HIGH_SPEED_CORNER]: { Cornering: 0.8, Acceleration: 0.1, Braking: 0.1 },
  [SEGMENT_TYPES.SHORT_STRAIGHT]: { Pace: 0.8, Acceleration: 0.2 },
  [SEGMENT_TYPES.MEDIUM_STRAIGHT]: { Pace: 0.8, Acceleration: 0.2 },
  [SEGMENT_TYPES.LONG_STRAIGHT]: { Pace: 0.8, Acceleration: 0.2 },
};
