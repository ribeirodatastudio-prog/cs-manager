/**
 * Season Calendar System
 * Schedules and manages all tournaments throughout the competitive year
 */

import { GameDate, GameCalendar, TimeManager } from './time-system';
import {
  TournamentTemplate,
  TournamentTier,
  Tournament,
  TournamentStage,
  MajorTournament,
  Tier1Tournament,
  Tier2Tournament,
  Tier3Tournament,
} from './tournament-system';

/**
 * Season Configuration
 */
export interface SeasonConfig {
  year: number;
  startWeek: number; // Week of the year when season starts (usually week 1)
  endWeek: number;   // Week of the year when season ends (usually week 52)
  offseasonWeeks: number; // Weeks between seasons
}

/**
 * Season Calendar
 */
export interface SeasonCalendar {
  config: SeasonConfig;
  tournaments: Tournament[];
  scheduledWeeks: Map<number, string[]>; // Week number -> Tournament IDs active that week
}

/**
 * Tournament Scheduler
 * Handles the complex task of scheduling tournaments throughout the year
 */
export class TournamentScheduler {
  private templates: Map<string, TournamentTemplate>;

  constructor() {
    this.templates = new Map();
    this.loadAllTemplates();
  }

  /**
   * Load all tournament templates
   */
  private loadAllTemplates(): void {
    // Load Majors
    const majors = MajorTournament.getYearlyMajors();
    majors.forEach(template => this.templates.set(template.id, template));

    // Load Tier 1
    const tier1 = Tier1Tournament.getYearlyTier1Tournaments();
    tier1.forEach(template => this.templates.set(template.id, template));

    // Load Tier 2
    const tier2 = Tier2Tournament.getYearlyTier2Tournaments();
    tier2.forEach(template => this.templates.set(template.id, template));

    // Load Tier 3
    const tier3 = Tier3Tournament.getYearlyTier3Tournaments();
    tier3.forEach(template => this.templates.set(template.id, template));
  }

  /**
   * Generate a complete season calendar
   */
  generateSeasonCalendar(year: number): SeasonCalendar {
    const config: SeasonConfig = {
      year,
      startWeek: 1,
      endWeek: 52,
      offseasonWeeks: 4,
    };

    // Schedule tournaments
    const tournaments: Tournament[] = [];
    const scheduledWeeks = new Map<number, string[]>();

    // First, schedule Majors at fixed times
    this.scheduleMajors(year, tournaments, scheduledWeeks);

    // Then schedule Tier 1 tournaments
    this.scheduleTier1Tournaments(year, tournaments, scheduledWeeks);

    // Then Tier 2
    this.scheduleTier2Tournaments(year, tournaments, scheduledWeeks);

    // Finally Tier 3
    this.scheduleTier3Tournaments(year, tournaments, scheduledWeeks);

    return {
      config,
      tournaments,
      scheduledWeeks,
    };
  }

  /**
   * Schedule the 2 Major tournaments
   */
  private scheduleMajors(
    year: number,
    tournaments: Tournament[],
    scheduledWeeks: Map<number, string[]>
  ): void {
    const majorTemplates = Array.from(this.templates.values())
      .filter(t => t.tier === TournamentTier.MAJOR);

    // Spring Major: Week 12-14 (mid-March)
    const springMajor = majorTemplates[0];
    if (springMajor) {
      const tournament = this.createTournamentInstance(springMajor, year, 12);
      tournaments.push(tournament);
      this.markWeeksAsOccupied(12, 3, tournament.id, scheduledWeeks);
    }

    // Fall Major: Week 38-40 (late September)
    const fallMajor = majorTemplates[1];
    if (fallMajor) {
      const tournament = this.createTournamentInstance(fallMajor, year, 38);
      tournaments.push(tournament);
      this.markWeeksAsOccupied(38, 3, tournament.id, scheduledWeeks);
    }
  }

  /**
   * Schedule Tier 1 tournaments (20 total, avoiding Major weeks)
   */
  private scheduleTier1Tournaments(
    year: number,
    tournaments: Tournament[],
    scheduledWeeks: Map<number, string[]>
  ): void {
    const tier1Templates = Array.from(this.templates.values())
      .filter(t => t.tier === TournamentTier.TIER_1)
      .slice(0, 20);

    let weekCursor = 1;

    for (const template of tier1Templates) {
      // Find next available slot (avoid Major weeks + buffer weeks)
      weekCursor = this.findNextAvailableWeek(
        weekCursor,
        template.totalDurationWeeks,
        scheduledWeeks,
        1 // 1 week buffer between major tournaments
      );

      if (weekCursor > 52 - template.totalDurationWeeks) {
        break; // Can't fit this tournament in the year
      }

      const tournament = this.createTournamentInstance(template, year, weekCursor);
      tournaments.push(tournament);
      this.markWeeksAsOccupied(weekCursor, template.totalDurationWeeks, tournament.id, scheduledWeeks);

      weekCursor += template.totalDurationWeeks + 1; // Move to next slot
    }
  }

  /**
   * Schedule Tier 2 tournaments (30 total, can run concurrently in different regions)
   */
  private scheduleTier2Tournaments(
    year: number,
    tournaments: Tournament[],
    scheduledWeeks: Map<number, string[]>
  ): void {
    const tier2Templates = Array.from(this.templates.values())
      .filter(t => t.tier === TournamentTier.TIER_2)
      .slice(0, 30);

    // Tier 2 tournaments can overlap since they're regional
    // Spread them throughout the year
    const weeksPerTournament = Math.floor(52 / 30);

    tier2Templates.forEach((template, index) => {
      const startWeek = 1 + (index * weeksPerTournament);

      if (startWeek <= 52 - template.totalDurationWeeks) {
        const tournament = this.createTournamentInstance(template, year, startWeek);
        tournaments.push(tournament);
        this.markWeeksAsOccupied(startWeek, template.totalDurationWeeks, tournament.id, scheduledWeeks);
      }
    });
  }

  /**
   * Schedule Tier 3 tournaments (40 total, heavily overlapping/regional)
   */
  private scheduleTier3Tournaments(
    year: number,
    tournaments: Tournament[],
    scheduledWeeks: Map<number, string[]>
  ): void {
    const tier3Templates = Array.from(this.templates.values())
      .filter(t => t.tier === TournamentTier.TIER_3)
      .slice(0, 40);

    // Tier 3 tournaments run constantly throughout the year
    // Almost every week has some Tier 3 event
    const weeksPerTournament = Math.floor(52 / 40);

    tier3Templates.forEach((template, index) => {
      const startWeek = 1 + (index * weeksPerTournament);

      if (startWeek <= 52 - template.totalDurationWeeks) {
        const tournament = this.createTournamentInstance(template, year, startWeek);
        tournaments.push(tournament);
        this.markWeeksAsOccupied(startWeek, template.totalDurationWeeks, tournament.id, scheduledWeeks);
      }
    });
  }

  /**
   * Find the next available week that can fit a tournament
   */
  private findNextAvailableWeek(
    startWeek: number,
    durationWeeks: number,
    scheduledWeeks: Map<number, string[]>,
    bufferWeeks: number = 0
  ): number {
    let week = startWeek;

    while (week <= 52 - durationWeeks) {
      let isAvailable = true;

      // Check if this week range is available
      for (let i = week - bufferWeeks; i < week + durationWeeks + bufferWeeks; i++) {
        if (i > 0 && i <= 52) {
          const occupants = scheduledWeeks.get(i) || [];
          // Check if any high-priority tournament (Major/Tier 1) is scheduled
          if (occupants.length > 0) {
            const hasHighPriority = occupants.some(id => {
              const template = this.templates.get(id.split('_instance_')[0]);
              return template && (template.tier === TournamentTier.MAJOR || template.tier === TournamentTier.TIER_1);
            });
            if (hasHighPriority) {
              isAvailable = false;
              break;
            }
          }
        }
      }

      if (isAvailable) {
        return week;
      }

      week++;
    }

    return week;
  }

  /**
   * Mark weeks as occupied by a tournament
   */
  private markWeeksAsOccupied(
    startWeek: number,
    duration: number,
    tournamentId: string,
    scheduledWeeks: Map<number, string[]>
  ): void {
    for (let week = startWeek; week < startWeek + duration; week++) {
      if (week > 0 && week <= 52) {
        const occupants = scheduledWeeks.get(week) || [];
        occupants.push(tournamentId);
        scheduledWeeks.set(week, occupants);
      }
    }
  }

  /**
   * Create a tournament instance from a template
   */
  private createTournamentInstance(
    template: TournamentTemplate,
    year: number,
    startWeek: number
  ): Tournament {
    const startDate: GameDate = { year, week: startWeek, day: 1 };
    const endDate = GameCalendar.addWeeks(startDate, template.totalDurationWeeks);

    return {
      id: `${template.id}_instance_${year}`,
      templateId: template.id,
      name: `${template.name} ${year}`,
      tier: template.tier,
      year,
      startDate,
      endDate,
      currentStage: template.stages[0]?.stage || TournamentStage.QUALIFIER,
      isActive: false,
      isCompleted: false,
      participatingTeams: [],
      qualifiedTeams: new Map(),
      standings: [],
      matches: [],
      stages: template.stages,
      prizePool: template.prizePool,
    };
  }

  /**
   * Get tournaments active in a specific week
   */
  static getTournamentsInWeek(
    calendar: SeasonCalendar,
    week: number
  ): Tournament[] {
    const tournamentIds = calendar.scheduledWeeks.get(week) || [];
    return calendar.tournaments.filter(t => tournamentIds.includes(t.id));
  }

  /**
   * Get upcoming tournaments (next N weeks)
   */
  static getUpcomingTournaments(
    calendar: SeasonCalendar,
    currentDate: GameDate,
    weeksAhead: number = 4
  ): Tournament[] {
    const upcoming: Tournament[] = [];
    const futureDate = GameCalendar.addWeeks(currentDate, weeksAhead);

    for (const tournament of calendar.tournaments) {
      if (
        !tournament.isCompleted &&
        GameCalendar.compareDates(tournament.startDate, futureDate) <= 0 &&
        GameCalendar.compareDates(tournament.startDate, currentDate) >= 0
      ) {
        upcoming.push(tournament);
      }
    }

    return upcoming.sort((a, b) =>
      GameCalendar.compareDates(a.startDate, b.startDate)
    );
  }

  /**
   * Get all Majors in a season
   */
  static getMajors(calendar: SeasonCalendar): Tournament[] {
    return calendar.tournaments.filter(t => t.tier === TournamentTier.MAJOR);
  }

  /**
   * Check if a team can participate in a tournament
   */
  static canTeamParticipate(
    tournament: Tournament,
    teamRanking: number,
    hasQualified: boolean = false
  ): boolean {
    const template = this.getTemplateById(tournament.templateId);
    if (!template) return false;

    // Check if team is within direct invite range
    if (teamRanking <= template.directInvites) {
      return true;
    }

    // Check if team has qualified through qualifiers
    if (hasQualified) {
      return true;
    }

    return false;
  }

  /**
   * Get template by ID (helper)
   */
  private static getTemplateById(templateId: string): TournamentTemplate | undefined {
    const scheduler = new TournamentScheduler();
    return scheduler.templates.get(templateId);
  }
}

/**
 * Season Manager
 * Manages the current season and progression
 */
export class SeasonManager {
  private calendar: SeasonCalendar;
  private timeManager: TimeManager;

  constructor(year: number, timeManager: TimeManager) {
    this.timeManager = timeManager;
    const scheduler = new TournamentScheduler();
    this.calendar = scheduler.generateSeasonCalendar(year);
  }

  /**
   * Get the current season calendar
   */
  getCalendar(): SeasonCalendar {
    return this.calendar;
  }

  /**
   * Update tournament states based on current date
   */
  updateTournaments(): void {
    const currentDate = this.timeManager.getCurrentDate();

    for (const tournament of this.calendar.tournaments) {
      // Check if tournament should start
      if (!tournament.isActive && !tournament.isCompleted) {
        if (GameCalendar.compareDates(currentDate, tournament.startDate) >= 0) {
          tournament.isActive = true;
          // console.log(`Tournament started: ${tournament.name}`);
        }
      }

      // Check if tournament should end
      if (tournament.isActive && !tournament.isCompleted) {
        if (GameCalendar.compareDates(currentDate, tournament.endDate) >= 0) {
          tournament.isActive = false;
          tournament.isCompleted = true;
          // console.log(`Tournament completed: ${tournament.name}`);
        }
      }
    }
  }

  /**
   * Get active tournaments
   */
  getActiveTournaments(): Tournament[] {
    return this.calendar.tournaments.filter(t => t.isActive);
  }

  /**
   * Get upcoming tournaments
   */
  getUpcomingTournaments(weeksAhead: number = 4): Tournament[] {
    return TournamentScheduler.getUpcomingTournaments(
      this.calendar,
      this.timeManager.getCurrentDate(),
      weeksAhead
    );
  }

  /**
   * Get summary of the season
   */
  getSeasonSummary(): {
    totalTournaments: number;
    completedTournaments: number;
    activeTournaments: number;
    upcomingTournaments: number;
    majorProgress: string;
  } {
    const total = this.calendar.tournaments.length;
    const completed = this.calendar.tournaments.filter(t => t.isCompleted).length;
    const active = this.calendar.tournaments.filter(t => t.isActive).length;
    const upcoming = this.getUpcomingTournaments().length;

    const majors = this.calendar.tournaments.filter(t => t.tier === TournamentTier.MAJOR);
    const completedMajors = majors.filter(m => m.isCompleted).length;
    const majorProgress = `${completedMajors}/${majors.length}`;

    return {
      totalTournaments: total,
      completedTournaments: completed,
      activeTournaments: active,
      upcomingTournaments: upcoming,
      majorProgress,
    };
  }
}
