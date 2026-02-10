/**
 * Tournament System for CS Manager
 * Handles tournament structures, formats, and scheduling
 */

import { GameDate, GameCalendar } from './time-system';

/**
 * Tournament Tiers
 */
export enum TournamentTier {
  MAJOR = 'major',           // Valve-sponsored Majors (2 per year)
  TIER_1 = 'tier_1',        // S-Tier events (20 per year)
  TIER_2 = 'tier_2',        // A-Tier events (30 per year)
  TIER_3 = 'tier_3',        // B-Tier events (40 per year)
}

/**
 * Tournament Stages
 */
export enum TournamentStage {
  // Major-specific stages
  OPENING = 'opening',           // Major Opening Stage (16 Contenders/Challengers)
  ELIMINATION = 'elimination',   // Major Elimination Stage (16 teams: 8 from Opening + 8 Legends)
  PLAYOFF = 'playoff',           // Major Playoffs (Top 8 Champions Stage)

  // Standard tournament stages
  QUALIFIER = 'qualifier',       // Open/Closed Qualifiers
  GROUP_STAGE = 'group_stage',  // Group Stage (GSL or Round Robin)
  PLAYOFFS = 'playoffs',         // Playoff Bracket
  FINALS = 'finals',            // Grand Finals
}

/**
 * Match Formats
 */
export enum MatchFormat {
  BO1 = 'bo1',   // Best of 1
  BO2 = 'bo2',   // Best of 2
  BO3 = 'bo3',   // Best of 3
  BO5 = 'bo5',   // Best of 5
}

/**
 * Tournament Format Types
 */
export enum TournamentFormat {
  SWISS = 'swiss',                      // Swiss System (3-0 or 0-3)
  SINGLE_ELIMINATION = 'single_elim',   // Single-elimination bracket
  DOUBLE_ELIMINATION = 'double_elim',   // Double-elimination bracket
  ROUND_ROBIN = 'round_robin',          // Round Robin (everyone plays everyone)
  GSL = 'gsl',                          // GSL Groups (double-elim groups)
}

/**
 * Tournament Prize Pool Distribution
 */
export interface PrizeDistribution {
  position: number;
  prize: number;
  points: number; // Ranking points
}

/**
 * Tournament Stage Configuration
 */
export interface StageConfig {
  stage: TournamentStage;
  format: TournamentFormat;
  matchFormat: MatchFormat;
  numberOfTeams: number;
  numberOfAdvancing?: number; // How many teams advance to next stage
  durationWeeks: number;
}

/**
 * Tournament Template
 */
export interface TournamentTemplate {
  id: string;
  name: string;
  tier: TournamentTier;
  organizer: string;
  location: string;

  // Tournament structure
  stages: StageConfig[];
  totalDurationWeeks: number;

  // Prize pool
  prizePool: number;
  prizeDistribution: PrizeDistribution[];

  // Qualification
  hasOpenQualifier: boolean;
  hasClosedQualifier: boolean;
  directInvites: number;

  // Scheduling (when in the year this tournament typically happens)
  schedulingPriority: number; // Higher = more prestigious/important
}

/**
 * Tournament Instance
 */
export interface Tournament {
  id: string;
  templateId: string;
  name: string;
  tier: TournamentTier;
  year: number;

  // Dates
  startDate: GameDate;
  endDate: GameDate;
  qualifierDate?: GameDate;

  // Current state
  currentStage: TournamentStage;
  isActive: boolean;
  isCompleted: boolean;

  // Participants
  participatingTeams: string[]; // Team IDs
  qualifiedTeams: Map<TournamentStage, string[]>; // Teams qualified for each stage

  // Results
  standings: TournamentStanding[];
  matches: TournamentMatch[];

  // Configuration
  stages: StageConfig[];
  prizePool: number;
}

/**
 * Tournament Standing
 */
export interface TournamentStanding {
  position: number;
  teamId: string;
  wins: number;
  losses: number;
  mapDifference: number; // Maps won - maps lost
  roundDifference: number; // Rounds won - rounds lost
  eliminated: boolean;
}

/**
 * Tournament Match
 */
export interface TournamentMatch {
  id: string;
  tournamentId: string;
  stage: TournamentStage;
  matchNumber: number;

  team1Id: string;
  team2Id: string;

  format: MatchFormat;
  maps: string[]; // Map names to be played

  scheduledDate: GameDate;
  isCompleted: boolean;

  // Results
  team1Score?: number; // Maps won
  team2Score?: number;
  winnerId?: string;
}

/**
 * Major Tournament Configuration
 */
export class MajorTournament {
  /**
   * Create a Major tournament template
   */
  static createMajorTemplate(
    name: string,
    organizer: string,
    location: string,
    prizePool: number = 1_250_000
  ): TournamentTemplate {
    return {
      id: `major_${name.toLowerCase().replace(/\s/g, '_')}`,
      name: `${name} Major`,
      tier: TournamentTier.MAJOR,
      organizer,
      location,

      stages: [
        // Opening Stage (16 Contenders/Challengers)
        {
          stage: TournamentStage.OPENING,
          format: TournamentFormat.SWISS,
          matchFormat: MatchFormat.BO1, // First matches BO1
          numberOfTeams: 16,
          numberOfAdvancing: 8,
          durationWeeks: 1,
        },
        // Elimination Stage (8 from Opening + 8 Legends = 16)
        {
          stage: TournamentStage.ELIMINATION,
          format: TournamentFormat.SWISS,
          matchFormat: MatchFormat.BO3, // Advancement/elimination matches BO3
          numberOfTeams: 16,
          numberOfAdvancing: 8,
          durationWeeks: 1,
        },
        // Champions Stage (Playoffs)
        {
          stage: TournamentStage.PLAYOFF,
          format: TournamentFormat.SINGLE_ELIMINATION,
          matchFormat: MatchFormat.BO3,
          numberOfTeams: 8,
          numberOfAdvancing: 1,
          durationWeeks: 1,
        },
      ],

      totalDurationWeeks: 3,
      prizePool,

      // Major prize distribution (approximate)
      prizeDistribution: [
        { position: 1, prize: 500_000, points: 1500 },
        { position: 2, prize: 300_000, points: 1200 },
        { position: 3, prize: 150_000, points: 1000 },
        { position: 4, prize: 100_000, points: 900 },
        { position: 5, prize: 50_000, points: 750 },
        { position: 6, prize: 50_000, points: 750 },
        { position: 7, prize: 30_000, points: 650 },
        { position: 8, prize: 30_000, points: 650 },
        { position: 9, prize: 15_000, points: 500 },
        { position: 10, prize: 15_000, points: 500 },
        { position: 11, prize: 10_000, points: 400 },
        { position: 12, prize: 10_000, points: 400 },
        { position: 13, prize: 8_000, points: 300 },
        { position: 14, prize: 8_000, points: 300 },
        { position: 15, prize: 7_000, points: 250 },
        { position: 16, prize: 7_000, points: 250 },
      ],

      hasOpenQualifier: true,
      hasClosedQualifier: true,
      directInvites: 8, // 8 Legends get direct invite to Elimination Stage
      schedulingPriority: 100, // Highest priority
    };
  }

  /**
   * Get the two major tournaments for the year
   */
  static getYearlyMajors(): TournamentTemplate[] {
    return [
      this.createMajorTemplate('Spring', 'PGL', 'Copenhagen', 1_250_000),
      this.createMajorTemplate('Fall', 'BLAST', 'Paris', 1_250_000),
    ];
  }
}

/**
 * Tier 1 Tournament Templates
 */
export class Tier1Tournament {
  static createTier1Template(
    name: string,
    organizer: string,
    location: string,
    prizePool: number = 500_000
  ): TournamentTemplate {
    return {
      id: `tier1_${name.toLowerCase().replace(/\s/g, '_')}`,
      name,
      tier: TournamentTier.TIER_1,
      organizer,
      location,

      stages: [
        {
          stage: TournamentStage.GROUP_STAGE,
          format: TournamentFormat.GSL,
          matchFormat: MatchFormat.BO3,
          numberOfTeams: 16,
          numberOfAdvancing: 8,
          durationWeeks: 1,
        },
        {
          stage: TournamentStage.PLAYOFFS,
          format: TournamentFormat.SINGLE_ELIMINATION,
          matchFormat: MatchFormat.BO3,
          numberOfTeams: 8,
          numberOfAdvancing: 1,
          durationWeeks: 1,
        },
      ],

      totalDurationWeeks: 2,
      prizePool,

      prizeDistribution: [
        { position: 1, prize: 200_000, points: 1000 },
        { position: 2, prize: 100_000, points: 800 },
        { position: 3, prize: 50_000, points: 650 },
        { position: 4, prize: 40_000, points: 550 },
        { position: 5, prize: 30_000, points: 400 },
        { position: 6, prize: 25_000, points: 400 },
        { position: 7, prize: 20_000, points: 300 },
        { position: 8, prize: 20_000, points: 300 },
      ],

      hasOpenQualifier: false,
      hasClosedQualifier: true,
      directInvites: 12,
      schedulingPriority: 80,
    };
  }

  /**
   * Get all Tier 1 tournaments for the year (20 total)
   */
  static getYearlyTier1Tournaments(): TournamentTemplate[] {
    const tournaments: TournamentTemplate[] = [];

    // IEM Circuit
    tournaments.push(this.createTier1Template('IEM Katowice', 'ESL', 'Katowice', 1_000_000));
    tournaments.push(this.createTier1Template('IEM Cologne', 'ESL', 'Cologne', 1_000_000));
    tournaments.push(this.createTier1Template('IEM Sydney', 'ESL', 'Sydney', 500_000));
    tournaments.push(this.createTier1Template('IEM Dallas', 'ESL', 'Dallas', 500_000));

    // BLAST Premier
    tournaments.push(this.createTier1Template('BLAST Premier Spring Groups', 'BLAST', 'Online', 425_000));
    tournaments.push(this.createTier1Template('BLAST Premier Spring Final', 'BLAST', 'Copenhagen', 425_000));
    tournaments.push(this.createTier1Template('BLAST Premier Fall Groups', 'BLAST', 'Online', 425_000));
    tournaments.push(this.createTier1Template('BLAST Premier Fall Final', 'BLAST', 'Paris', 425_000));
    tournaments.push(this.createTier1Template('BLAST Premier World Final', 'BLAST', 'Abu Dhabi', 1_000_000));

    // ESL Pro League
    tournaments.push(this.createTier1Template('ESL Pro League Season 19', 'ESL', 'Malta', 750_000));
    tournaments.push(this.createTier1Template('ESL Pro League Season 20', 'ESL', 'Malta', 750_000));

    // PGL Events
    tournaments.push(this.createTier1Template('PGL Copenhagen', 'PGL', 'Copenhagen', 500_000));
    tournaments.push(this.createTier1Template('PGL Bucharest', 'PGL', 'Bucharest', 500_000));

    // BLAST.tv Events
    tournaments.push(this.createTier1Template('BLAST.tv Paris', 'BLAST', 'Paris', 500_000));
    tournaments.push(this.createTier1Template('BLAST.tv Miami', 'BLAST', 'Miami', 500_000));

    // YaLLa Compass
    tournaments.push(this.createTier1Template('YaLLa Compass', 'YaLLa', 'Jeddah', 400_000));

    // Gamers8
    tournaments.push(this.createTier1Template('Gamers8', 'Saudi Esports', 'Riyadh', 1_000_000));

    // MESA Events
    tournaments.push(this.createTier1Template('MESA Nomadic Masters', 'MESA', 'Dubai', 400_000));

    // CCT Finals
    tournaments.push(this.createTier1Template('CCT Global Finals', 'CCT', 'Shanghai', 500_000));

    // Elisa Invitational
    tournaments.push(this.createTier1Template('Elisa Invitational', 'Elisa', 'Helsinki', 400_000));

    return tournaments.slice(0, 20); // Ensure exactly 20
  }
}

/**
 * Tier 2 Tournament Templates
 */
export class Tier2Tournament {
  static createTier2Template(
    name: string,
    region: 'EU' | 'NA' | 'SA' | 'ASIA' | 'OCE' = 'EU',
    prizePool: number = 100_000
  ): TournamentTemplate {
    return {
      id: `tier2_${name.toLowerCase().replace(/\s/g, '_')}`,
      name,
      tier: TournamentTier.TIER_2,
      organizer: 'Various',
      location: region,

      stages: [
        {
          stage: TournamentStage.GROUP_STAGE,
          format: TournamentFormat.ROUND_ROBIN,
          matchFormat: MatchFormat.BO3,
          numberOfTeams: 8,
          numberOfAdvancing: 4,
          durationWeeks: 1,
        },
        {
          stage: TournamentStage.PLAYOFFS,
          format: TournamentFormat.SINGLE_ELIMINATION,
          matchFormat: MatchFormat.BO3,
          numberOfTeams: 4,
          numberOfAdvancing: 1,
          durationWeeks: 1,
        },
      ],

      totalDurationWeeks: 2,
      prizePool,

      prizeDistribution: [
        { position: 1, prize: 40_000, points: 400 },
        { position: 2, prize: 25_000, points: 300 },
        { position: 3, prize: 20_000, points: 200 },
        { position: 4, prize: 15_000, points: 150 },
      ],

      hasOpenQualifier: true,
      hasClosedQualifier: false,
      directInvites: 4,
      schedulingPriority: 50,
    };
  }

  /**
   * Generate 30 Tier 2 tournaments for the year
   */
  static getYearlyTier2Tournaments(): TournamentTemplate[] {
    const tournaments: TournamentTemplate[] = [];
    const regions: ('EU' | 'NA' | 'SA' | 'ASIA' | 'OCE')[] = ['EU', 'NA', 'SA', 'ASIA', 'OCE'];

    // 6 tournaments per region
    regions.forEach(region => {
      for (let i = 1; i <= 6; i++) {
        tournaments.push(
          this.createTier2Template(`${region} Masters ${i}`, region, 100_000)
        );
      }
    });

    return tournaments;
  }
}

/**
 * Tier 3 Tournament Templates
 */
export class Tier3Tournament {
  static createTier3Template(
    name: string,
    region: 'EU' | 'NA' | 'SA' | 'ASIA' | 'OCE' = 'EU',
    prizePool: number = 25_000
  ): TournamentTemplate {
    return {
      id: `tier3_${name.toLowerCase().replace(/\s/g, '_')}`,
      name,
      tier: TournamentTier.TIER_3,
      organizer: 'Regional',
      location: region,

      stages: [
        {
          stage: TournamentStage.QUALIFIER,
          format: TournamentFormat.SINGLE_ELIMINATION,
          matchFormat: MatchFormat.BO1,
          numberOfTeams: 16,
          numberOfAdvancing: 8,
          durationWeeks: 1,
        },
        {
          stage: TournamentStage.PLAYOFFS,
          format: TournamentFormat.SINGLE_ELIMINATION,
          matchFormat: MatchFormat.BO3,
          numberOfTeams: 8,
          numberOfAdvancing: 1,
          durationWeeks: 1,
        },
      ],

      totalDurationWeeks: 2,
      prizePool,

      prizeDistribution: [
        { position: 1, prize: 10_000, points: 150 },
        { position: 2, prize: 7_000, points: 100 },
        { position: 3, prize: 5_000, points: 75 },
        { position: 4, prize: 3_000, points: 50 },
      ],

      hasOpenQualifier: true,
      hasClosedQualifier: false,
      directInvites: 0,
      schedulingPriority: 25,
    };
  }

  /**
   * Generate 40 Tier 3 tournaments for the year
   */
  static getYearlyTier3Tournaments(): TournamentTemplate[] {
    const tournaments: TournamentTemplate[] = [];
    const regions: ('EU' | 'NA' | 'SA' | 'ASIA' | 'OCE')[] = ['EU', 'NA', 'SA', 'ASIA', 'OCE'];

    // 8 tournaments per region
    regions.forEach(region => {
      for (let i = 1; i <= 8; i++) {
        tournaments.push(
          this.createTier3Template(`${region} Open ${i}`, region, 25_000)
        );
      }
    });

    return tournaments;
  }
}
