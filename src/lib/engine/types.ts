export interface Connection {
  to: string;
  sightline: boolean;
  distance?: number;
}

export interface Zone {
  id: string;
  name: string;
  x: number; // Visual X coordinate (0-100 or specific pixel grid, let's assume 0-1000 for granularity)
  y: number; // Visual Y coordinate
  connections: Connection[]; // IDs of adjacent zones
  cover: number; // 0.0 to 1.0 (0% to 100% cover bonus)
}

export interface SplitGroup {
  name: string; // e.g. "Long", "Short", "Tunnels"
  pincerPoint: string; // Zone ID to wait at
  path?: string[]; // Optional specific path to pincer point
}

export interface StrategyData {
  split: {
    A: SplitGroup[];
    B: SplitGroup[];
  };
}

export interface MapData {
  id: string;
  name: string;
  zones: Zone[];
  spawnPoints: {
    CT: string; // Zone ID
    T: string; // Zone ID
  };
  bombSites: {
    A: string; // Zone ID
    B: string; // Zone ID
  };
  strategies?: StrategyData;
  postPlantPositions?: {
    A: string[];
    B: string[];
  };
}

export enum MatchPhase {
  WARMUP = "WARMUP",
  FREEZETIME = "FREEZETIME",
  PAUSED_FOR_STRATEGY = "PAUSED_FOR_STRATEGY",
  LIVE = "LIVE",
  ROUND_END = "ROUND_END",
  HALFTIME = "HALFTIME",
  MATCH_END = "MATCH_END"
}

export type BuyStrategy = "ECO" | "FORCE" | "FULL" | "HALF" | "BONUS" | "HERO";

export enum RoundEndReason {
  ELIMINATION_T = "ELIMINATION_T",
  ELIMINATION_CT = "ELIMINATION_CT",
  TARGET_BOMBED = "TARGET_BOMBED",
  BOMB_DEFUSED = "BOMB_DEFUSED",
  TIME_RUNNING_OUT = "TIME_RUNNING_OUT"
}

export interface MatchState {
  round: number;
  scores: {
    T: number;
    CT: number;
  };
  phase: MatchPhase;
  phaseTimer: number; // Seconds remaining in phase
  lossBonus: {
    T: number; // Count (0-4)
    CT: number;
  };
  winThreshold: number; // Rounds needed to win (13, 16, 19...)
  roundHistory: RoundHistory[];
}

export interface RoundHistory {
  roundNumber: number;
  winner: "T" | "CT";
  reason: RoundEndReason;
  endTick: number;
}

export interface DroppedWeapon {
  id: string; // Unique ID
  weaponId: string; // "ak-47", etc.
  zoneId: string;
  x: number; // For visualization within the zone
  y: number;
}
