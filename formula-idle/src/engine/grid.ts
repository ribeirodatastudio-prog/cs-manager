import { calculateTeamStatsBudget, randomFloat, randomInt } from './mathUtils';
import { GRID, STAT_NAMES, type StatName } from './data';

export interface Driver {
  id: string;
  name: string;
  teamId: string;
  stats: Record<StatName, number>;
  totalStats: number;
  championshipPoints: number;
}

export interface Team {
  id: string;
  name: string;
  rank: number;
  drivers: Driver[];
  totalStats: number; // Baseline for generation
  championshipPoints: number;
}

const TEAM_NAMES = [
  "Velocity Racing", "Scuderia Rosso", "Silver Arrows", "Papaya Speed", "Alpine Blue",
  "Green Martin", "Alpha Dogs", "Haas Brothers", "Williams Blue", "Clean Sauber",
  "Dragon Speed", "Panther Racing", "Cosmic Motors", "Thunder Bolt", "Apex Predators",
  "Quantum Racing", "Nebula GP", "Vortex Autosport", "Titanium F1", "Phoenix Rising"
];

const FIRST_NAMES = [
  "Max", "Lewis", "Charles", "Lando", "Fernando", "George", "Carlos", "Oscar", "Sergio", "Pierre",
  "Alex", "Nico", "Kevin", "Yuki", "Lance", "Valtteri", "Zhou", "Daniel", "Esteban", "Logan",
  "Mick", "Sebastian", "Kimi", "Michael", "Ayrton", "Alain", "Niki", "James", "Jenson", "Damon"
];

const LAST_NAMES = [
  "Verstappen", "Hamilton", "Leclerc", "Norris", "Alonso", "Russell", "Sainz", "Piastri", "Perez", "Gasly",
  "Albon", "Hulkenberg", "Magnussen", "Tsunoda", "Stroll", "Bottas", "Guanyu", "Ricciardo", "Ocon", "Sargeant",
  "Schumacher", "Vettel", "Raikkonen", "Senna", "Prost", "Lauda", "Hunt", "Button", "Hill", "Mansell"
];

const generateName = () => {
  const first = FIRST_NAMES[randomInt(0, FIRST_NAMES.length - 1)];
  const last = LAST_NAMES[randomInt(0, LAST_NAMES.length - 1)];
  return `${first} ${last}`;
};

const distributePointsToStats = (totalPoints: number): Record<StatName, number> => {
  const stats: Record<string, number> = {};
  STAT_NAMES.forEach(stat => stats[stat] = 0);

  // Simple random distribution:
  // Give each stat at least 1 point (if possible)
  let remaining = totalPoints;
  const numStats = STAT_NAMES.length;

  if (remaining < numStats) {
      // Edge case: very low stats
      for (let i = 0; i < remaining; i++) {
          stats[STAT_NAMES[i]]++;
      }
      return stats as Record<StatName, number>;
  }

  // Base distribution
  STAT_NAMES.forEach(stat => {
      stats[stat] = 1;
      remaining--;
  });

  // Distribute remaining randomly
  while (remaining > 0) {
      const stat = STAT_NAMES[randomInt(0, numStats - 1)];
      stats[stat]++;
      remaining--;
  }

  return stats as Record<StatName, number>;
};

export const generateGrid = (): Team[] => {
  const teams: Team[] = [];

  for (let rank = 1; rank <= GRID.TOTAL_TEAMS; rank++) {
    const baselineBudget = calculateTeamStatsBudget(
      rank,
      GRID.TOTAL_TEAMS,
      GRID.TIER_1_MIN_STATS,
      GRID.TIER_1_MAX_STATS,
      GRID.DISTRIBUTION_FACTOR
    );

    const teamId = `team-${rank}`;
    const teamName = TEAM_NAMES[rank - 1] || `Team ${rank}`;

    const drivers: Driver[] = [];

    // Generate 2 drivers
    for (let d = 0; d < GRID.DRIVERS_PER_TEAM; d++) {
      // Driver 1 is roughly the baseline. Driver 2 is slightly worse/different.
      let budget = baselineBudget;
      if (d === 1) {
         const variance = randomFloat(1.01, 1.10);
         budget = Math.floor(baselineBudget / variance);
      } else {
         budget = Math.floor(baselineBudget);
      }

      const driverStats = distributePointsToStats(budget);

      drivers.push({
        id: `driver-${rank}-${d}`,
        name: generateName(),
        teamId,
        stats: driverStats,
        totalStats: budget,
        championshipPoints: 0
      });
    }

    teams.push({
      id: teamId,
      name: teamName,
      rank,
      drivers,
      totalStats: baselineBudget,
      championshipPoints: 0
    });
  }

  return teams;
};

export const initializeSeason = (): Team[] => {
  return generateGrid();
};
