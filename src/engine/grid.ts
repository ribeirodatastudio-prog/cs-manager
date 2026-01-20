import { calculateTeamStatsBudget, randomFloat, randomInt } from './mathUtils';
import { GRID, STAT_NAMES, CAR_STAT_NAMES, type StatName, type CarStatName } from './data';

export interface Car {
  stats: Record<CarStatName, number>;
  totalStats: number;
}

export interface Driver {
  id: string;
  name: string;
  nationality: string;
  flag: string;
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
  car: Car;
  totalStats: number; // Baseline for generation
  championshipPoints: number;
}

const TEAM_NAMES = [
  "Velocity Racing", "Scuderia Rosso", "Silver Arrows", "Papaya Speed", "Alpine Blue",
  "Green Martin", "Alpha Dogs", "Haas Brothers", "Williams Blue", "Clean Sauber",
  "Dragon Speed", "Panther Racing", "Cosmic Motors", "Thunder Bolt", "Apex Predators",
  "Quantum Racing", "Nebula GP", "Vortex Autosport", "Titanium F1", "Phoenix Rising"
];

const NAME_POOLS: Record<string, { country: string; code: string; flag: string; first: string[]; last: string[] }> = {
  BRA: {
    country: "Brazil",
    code: "BRA",
    flag: "🇧🇷",
    first: ["Mateo", "Felipe", "Lucas", "Gabriel", "Enzo", "Rafael", "Bruno", "Thiago", "Pedro", "Gustavo", "Rodrigo", "Leonardo", "Daniel", "Eduardo", "Andre", "Fernando", "Ricardo", "Alexandre", "Caio", "Vitor"],
    last: ["Silva", "Santos", "Oliveira", "Souza", "Lima", "Ferreira", "Costa", "Pereira", "Carvalho", "Almeida", "Ribeiro", "Martins", "Gomes", "Barbosa", "Rocha", "Alves", "Araujo", "Teixeira", "Mendes", "Cardoso"]
  },
  GBR: {
    country: "United Kingdom",
    code: "GBR",
    flag: "🇬🇧",
    first: ["James", "Lewis", "George", "Lando", "Oliver", "Harry", "Jack", "Charlie", "Thomas", "William", "Daniel", "Matthew", "Ryan", "Liam", "Ben", "Connor", "Callum", "Alex", "Sam", "Joe"],
    last: ["Smith", "Taylor", "Wilson", "Norris", "Russell", "Hamilton", "Brown", "Evans", "Walker", "Johnson", "Robinson", "Wright", "Thompson", "White", "Hall", "Green", "Clarke", "Hill", "Wood", "Hughes"]
  },
  ITA: {
    country: "Italy",
    code: "ITA",
    flag: "🇮🇹",
    first: ["Alessandro", "Lorenzo", "Matteo", "Francesco", "Leonardo", "Davide", "Federico", "Marco", "Giuseppe", "Antonio", "Giovanni", "Roberto", "Andrea", "Michele", "Luca", "Simone", "Stefano", "Giorgio", "Enrico", "Fabio"],
    last: ["Rossi", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Conti", "De Luca", "Costa", "Giordano", "Mancini", "Rizzo", "Lombardi", "Moretti", "Barbieri"]
  },
  GER: {
    country: "Germany",
    code: "GER",
    flag: "🇩🇪",
    first: ["Maximilian", "Paul", "Lukas", "Felix", "Jonas", "Leon", "Finn", "Elias", "Tim", "Luis", "Julian", "Niklas", "Jan", "Philipp", "Sebastian", "Nico", "Mick", "David", "Simon", "Ben"],
    last: ["Muller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann", "Schafer", "Koch", "Bauer", "Richter", "Klein", "Wolf", "Schroder", "Neumann", "Schwarz", "Zimmermann"]
  },
  FRA: {
    country: "France",
    code: "FRA",
    flag: "🇫🇷",
    first: ["Lucas", "Hugo", "Louis", "Arthur", "Nathan", "Thomas", "Leo", "Gabriel", "Enzo", "Jules", "Mathis", "Theo", "Maxime", "Antoine", "Clement", "Axel", "Paul", "Pierre", "Esteban", "Romain"],
    last: ["Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Lefebvre", "Michel", "Garcia", "David", "Bertrand", "Roux", "Vincent", "Fournier"]
  },
  ESP: {
    country: "Spain",
    code: "ESP",
    flag: "🇪🇸",
    first: ["Antonio", "Manuel", "Jose", "David", "Juan", "Javier", "Daniel", "Francisco", "Carlos", "Jesus", "Alejandro", "Miguel", "Rafael", "Pedro", "Angel", "Pablo", "Sergio", "Fernando", "Jorge", "Luis"],
    last: ["Garcia", "Gonzalez", "Rodriguez", "Fernandez", "Lopez", "Martinez", "Sanchez", "Perez", "Gomez", "Martin", "Jimenez", "Ruiz", "Hernandez", "Diaz", "Moreno", "Muñoz", "Alvarez", "Romero", "Alonso", "Gutierrez"]
  },
  USA: {
    country: "United States",
    code: "USA",
    flag: "🇺🇸",
    first: ["James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas", "Charles", "Christopher", "Daniel", "Matthew", "Anthony", "Donald", "Mark", "Paul", "Steven", "Andrew", "Kenneth"],
    last: ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"]
  },
  JPN: {
    country: "Japan",
    code: "JPN",
    flag: "🇯🇵",
    first: ["Hiroshi", "Takashi", "Kenji", "Akira", "Yuki", "Kazuo", "Takeshi", "Masahiro", "Yoshio", "Tadashi", "Naoki", "Hideo", "Toshiyuki", "Koji", "Satoshi", "Shinji", "Yusuke", "Daisuke", "Ryota", "Kenta"],
    last: ["Sato", "Suzuki", "Takahashi", "Tanaka", "Watanabe", "Ito", "Yamamoto", "Nakamura", "Kobayashi", "Kato", "Yoshida", "Yamada", "Sasaki", "Yamaguchi", "Saito", "Matsumoto", "Inoue", "Kimura", "Hayashi", "Shimizu"]
  }
};

export const generateDriverIdentity = () => {
  const countryKeys = Object.keys(NAME_POOLS);
  const selectedKey = countryKeys[randomInt(0, countryKeys.length - 1)];
  const nation = NAME_POOLS[selectedKey];

  const first = nation.first[randomInt(0, nation.first.length - 1)];
  const last = nation.last[randomInt(0, nation.last.length - 1)];

  return {
    name: `${first} ${last}`,
    nationality: nation.country,
    flag: nation.flag
  };
};

export const generateDriverName = () => {
  return generateDriverIdentity().name;
};

export const generateRandomTeamName = () => {
  return TEAM_NAMES[randomInt(0, TEAM_NAMES.length - 1)];
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

const distributePointsToCarStats = (totalPoints: number): Record<CarStatName, number> => {
  const stats: Record<string, number> = {};
  CAR_STAT_NAMES.forEach(stat => stats[stat] = 0);

  let remaining = totalPoints;
  const numStats = CAR_STAT_NAMES.length;

  if (remaining < numStats) {
      for (let i = 0; i < remaining; i++) {
          stats[CAR_STAT_NAMES[i]]++;
      }
      return stats as Record<CarStatName, number>;
  }

  CAR_STAT_NAMES.forEach(stat => {
      stats[stat] = 1;
      remaining--;
  });

  while (remaining > 0) {
      const stat = CAR_STAT_NAMES[randomInt(0, numStats - 1)];
      stats[stat]++;
      remaining--;
  }

  return stats as Record<CarStatName, number>;
};

export const generateGrid = (): Team[] => {
  const teams: Team[] = [];

  for (let rank = 1; rank <= GRID.TOTAL_TEAMS; rank++) {
    const totalPower = calculateTeamStatsBudget(
      rank,
      GRID.TOTAL_TEAMS,
      GRID.TIER_1_MIN_STATS,
      GRID.TIER_1_MAX_STATS,
      GRID.DISTRIBUTION_FACTOR
    );

    // Split 60% Car, 40% Driver
    const carBudget = Math.floor(totalPower * 0.6);
    const driverBaseBudget = Math.floor(totalPower * 0.4);

    const teamId = `team-${rank}`;
    const teamName = TEAM_NAMES[rank - 1] || `Team ${rank}`;

    // Generate Car
    const carStats = distributePointsToCarStats(carBudget);
    const car: Car = {
      stats: carStats,
      totalStats: carBudget
    };

    const drivers: Driver[] = [];

    // Generate 2 drivers
    for (let d = 0; d < GRID.DRIVERS_PER_TEAM; d++) {
      // Driver 1 is roughly the baseline. Driver 2 is slightly worse/different.
      let budget = driverBaseBudget;
      if (d === 1) {
         const variance = randomFloat(1.01, 1.10);
         budget = Math.floor(driverBaseBudget / variance);
      } else {
         budget = Math.floor(driverBaseBudget);
      }

      const driverStats = distributePointsToStats(budget);
      const identity = generateDriverIdentity();

      drivers.push({
        id: `driver-${rank}-${d}`,
        name: identity.name,
        nationality: identity.nationality,
        flag: identity.flag,
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
      car,
      totalStats: totalPower,
      championshipPoints: 0
    });
  }

  return teams;
};

export const initializeSeason = (): Team[] => {
  return generateGrid();
};
