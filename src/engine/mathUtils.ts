import { ECONOMY } from './data';

export const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

export const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export const randomFloat = (min: number, max: number) => Math.random() * (max - min) + min;

export const calculateStatCost = (currentLevel: number) => {
  // Base Cost * 1.05 ^ Level
  // Since level starts at 1 usually, or 0?
  // "Base Cost: 1. Growth: Cost * 1.05 per level."
  // If Level 0 -> Cost 1.
  // Level 1 -> 1.05.
  // Formula: Base * (1.05 ^ Level)
  // We'll treat 'currentLevel' as the level you are buying (e.g. going from 0 to 1 costs calculation for level 0).
  // Or usually, cost to upgrade FROM level L to L+1.
  return ECONOMY.BASE_COST * Math.pow(ECONOMY.COST_EXPONENT, currentLevel);
};

export const getStability = (consistency: number): number => {
  // StabilityFactor = Min(Driver.Consistency, 100) / 100 * 0.95
  return Math.min(consistency, 100) / 100 * 0.95;
};

export const getChaosWindow = (consistency: number): number => {
  // Base Chaos: 0.35 (35%)
  // EffectiveChaos = BaseChaos * (1 - StabilityFactor)
  const baseChaos = 0.35;
  const stability = getStability(consistency);
  return baseChaos * (1 - stability);
};

/**
 * Calculates the total stat budget for a team based on its rank.
 * @param rank 1-based rank (1 to TotalTeams)
 * @param totalTeams Total number of teams
 * @param minStats Minimum total stats (Rank N)
 * @param maxStats Maximum total stats (Rank 1)
 * @param factor Distribution factor (Curve)
 */
export const calculateTeamStatsBudget = (
  rank: number,
  totalTeams: number,
  minStats: number,
  maxStats: number,
  factor: number
): number => {
  if (totalTeams <= 1) return maxStats;

  // Normalized position: 1.0 for Rank 1, 0.0 for Rank Last.
  // ((Total - Rank) / (Total - 1))
  const normalizedPos = (totalTeams - rank) / (totalTeams - 1);

  // Apply curve
  const curvedPos = Math.pow(normalizedPos, factor);

  // Map back to range
  return minStats + (maxStats - minStats) * curvedPos;
};

export const formatTime = (seconds: number): string => {
  if (seconds === Infinity) return "--:--:--";

  if (seconds < 60) {
    return seconds.toFixed(3);
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    const secStr = remainingSeconds.toFixed(3).padStart(6, '0');
    return `${minutes}:${secStr}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const secStr = remainingSeconds.toFixed(3).padStart(6, '0');
  const minStr = remainingMinutes.toString().padStart(2, '0');

  return `${hours}:${minStr}:${secStr}`;
};
