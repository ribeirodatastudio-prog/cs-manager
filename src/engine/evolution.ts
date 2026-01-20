import { type Team } from './grid';
import { CAR_STAT_NAMES } from './data';
import { randomInt } from './mathUtils';

export interface EvolutionReport {
  newGrid: Team[];
  logs: string[];
}

export const processTeamEvolution = (currentGrid: Team[]): EvolutionReport => {
  // Deep copy grid to avoid mutation issues
  const newGrid = currentGrid.map(team => ({
    ...team,
    drivers: team.drivers.map(d => ({
        ...d,
        stats: { ...d.stats }
    })),
    car: {
        ...team.car,
        stats: { ...team.car.stats }
    }
  }));

  const logs: string[] = [];

  newGrid.forEach(team => {
    // 1. Roll for Outcome
    const roll = randomInt(0, 100);
    let percent = 0;
    let minPoints = 0;
    let type = '';

    if (roll <= 30) {
      // Stagnation (30%)
      return;
    } else if (roll <= 70) {
      // Minor Upgrade (40%)
      type = 'Minor Upgrade';
      percent = 0.01;
      minPoints = 1;
    } else if (roll <= 90) {
      // Major Upgrade (20%)
      type = 'Major Upgrade';
      percent = 0.02;
      minPoints = 2;
    } else if (roll <= 95) {
      // Failure (5%)
      type = 'Development Failure';
      percent = -0.01;
      minPoints = -1;
    } else if (roll <= 99) {
      // Breakthrough (4%)
      type = 'Breakthrough';
      percent = 0.03;
      minPoints = 3;
    } else {
      // Game Changer (1%)
      type = 'Game Changer';
      percent = 0.06;
      minPoints = 5;
    }

    // 2. Calculate Total Stats for the Team
    let teamTotalStats = 0;
    team.drivers.forEach(d => {
       teamTotalStats += d.totalStats;
    });
    // Add Car Stats
    if (team.car) {
        teamTotalStats += team.car.totalStats;
    }

    // 3. Calculate Pool
    let pool = Math.floor(teamTotalStats * percent);

    // Apply Minimums
    if (percent > 0) {
       if (pool < minPoints) pool = minPoints;
    } else {
       // Negative handling
       // e.g. if calculated is 0 but min is -1 (failure), force -1.
       // if calculated is -10, that's fine.
       if (pool === 0) pool = -1;
    }

    const pointsToDistribute = pool;
    if (pointsToDistribute === 0) return;

    // 4. Distribute to CAR
    const isNegative = pointsToDistribute < 0;
    const absPoints = Math.abs(pointsToDistribute);
    let distributed = 0;
    let attempts = 0;

    // Prevent infinite loops if stats are maxed or minned out
    while (distributed < absPoints && attempts < absPoints * 10 + 20) {
       attempts++;

       const statName = CAR_STAT_NAMES[randomInt(0, CAR_STAT_NAMES.length - 1)];
       const currentVal = (team.car.stats as any)[statName];

       if (isNegative) {
          if (currentVal > 1) {
             (team.car.stats as any)[statName]--;
             team.car.totalStats--;
             distributed++;
          }
       } else {
          // Positive
          // No cap for car stats currently
          (team.car.stats as any)[statName]++;
          team.car.totalStats++;
          distributed++;
       }
    }

    // Only log if we actually changed something
    if (distributed > 0) {
        const finalChange = isNegative ? -distributed : distributed;
        const sign = finalChange > 0 ? '+' : '';
        logs.push(`${team.name} Car: ${type} (${sign}${finalChange} pts)`);
    }
  });

  return { newGrid, logs };
};
