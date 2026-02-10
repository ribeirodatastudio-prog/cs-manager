/**
 * Time Progression System for CS Manager
 * Handles weekly simulation, calendar management, and time-based events
 */

export interface GameDate {
  year: number;
  week: number; // 1-52 (or 53 in some years)
  day: number; // Day of week (1-7, Monday = 1)
}

export interface TimeSystemState {
  currentDate: GameDate;
  isPaused: boolean;
  simulationSpeed: 'normal' | 'fast' | 'instant'; // For future use
  scheduledEvents: ScheduledEvent[];
}

export interface ScheduledEvent {
  id: string;
  type: 'tournament_start' | 'tournament_end' | 'transfer_window_open' | 'transfer_window_close' | 'training' | 'match' | 'rest_day';
  date: GameDate;
  data: Record<string, unknown>; // Event-specific data
}

/**
 * Calendar utilities
 */
export class GameCalendar {
  /**
   * Get the number of weeks in a year
   * Most years have 52 weeks, some have 53
   */
  static getWeeksInYear(year: number): number {
    // Simple approach: ISO 8601 week date system
    // A year has 53 weeks if it starts on Thursday or if it's a leap year starting on Wednesday
    const jan1 = new Date(year, 0, 1);
    const day = jan1.getDay();
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);

    if (day === 4 || (isLeapYear && day === 3)) {
      return 53;
    }
    return 52;
  }

  /**
   * Advance the date by a number of weeks
   */
  static addWeeks(date: GameDate, weeks: number): GameDate {
    let { year, week } = date;
    const { day } = date;
    week += weeks;

    while (week > this.getWeeksInYear(year)) {
      week -= this.getWeeksInYear(year);
      year++;
    }

    return { year, week, day };
  }

  /**
   * Advance the date by a number of days
   */
  static addDays(date: GameDate, days: number): GameDate {
    let { year, week, day } = date;
    day += days;

    while (day > 7) {
      day -= 7;
      week++;
      if (week > this.getWeeksInYear(year)) {
        week = 1;
        year++;
      }
    }

    return { year, week, day };
  }

  /**
   * Compare two dates
   * Returns: -1 if date1 < date2, 0 if equal, 1 if date1 > date2
   */
  static compareDates(date1: GameDate, date2: GameDate): number {
    if (date1.year !== date2.year) {
      return date1.year < date2.year ? -1 : 1;
    }
    if (date1.week !== date2.week) {
      return date1.week < date2.week ? -1 : 1;
    }
    if (date1.day !== date2.day) {
      return date1.day < date2.day ? -1 : 1;
    }
    return 0;
  }

  /**
   * Check if date1 is before date2
   */
  static isBefore(date1: GameDate, date2: GameDate): boolean {
    return this.compareDates(date1, date2) < 0;
  }

  /**
   * Check if date1 is after date2
   */
  static isAfter(date1: GameDate, date2: GameDate): boolean {
    return this.compareDates(date1, date2) > 0;
  }

  /**
   * Get a human-readable date string
   */
  static formatDate(date: GameDate): string {
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return `Week ${date.week}, ${date.year} (${dayNames[date.day - 1]})`;
  }

  /**
   * Get the week number for a specific month/week combination
   * Used for tournament scheduling
   */
  static getWeekOfMonth(month: number, weekInMonth: number): number {
    // Approximate: 4.33 weeks per month on average
    // January = weeks 1-4, February = weeks 5-9, etc.
    const approximateWeek = Math.floor((month - 1) * 4.33) + weekInMonth;
    return Math.min(52, approximateWeek);
  }
}

/**
 * Time Progression Manager
 */
export class TimeManager {
  private state: TimeSystemState;
  private eventCallbacks: Map<string, (event: ScheduledEvent) => void>;

  constructor(startYear: number = 2025) {
    this.state = {
      currentDate: { year: startYear, week: 1, day: 1 },
      isPaused: false,
      simulationSpeed: 'normal',
      scheduledEvents: [],
    };
    this.eventCallbacks = new Map();
  }

  /**
   * Get current date
   */
  getCurrentDate(): GameDate {
    return { ...this.state.currentDate };
  }

  /**
   * Set the current date (for initialization or loading saves)
   */
  setCurrentDate(date: GameDate): void {
    this.state.currentDate = date;
  }

  /**
   * Advance time by one week
   * This is the primary time progression method
   */
  advanceWeek(): ScheduledEvent[] {
    if (this.state.isPaused) {
      return [];
    }

    // Advance the date
    this.state.currentDate = GameCalendar.addWeeks(this.state.currentDate, 1);

    // Process events for this week
    const eventsThisWeek = this.getEventsForCurrentWeek();

    // Trigger event callbacks
    eventsThisWeek.forEach(event => {
      const callback = this.eventCallbacks.get(event.type);
      if (callback) {
        callback(event);
      }
    });

    // Remove processed events
    this.state.scheduledEvents = this.state.scheduledEvents.filter(
      event => GameCalendar.isAfter(event.date, this.state.currentDate)
    );

    return eventsThisWeek;
  }

  /**
   * Get all events scheduled for the current week
   */
  private getEventsForCurrentWeek(): ScheduledEvent[] {
    return this.state.scheduledEvents.filter(event => {
      return (
        event.date.year === this.state.currentDate.year &&
        event.date.week === this.state.currentDate.week
      );
    });
  }

  /**
   * Schedule a new event
   */
  scheduleEvent(event: ScheduledEvent): void {
    this.state.scheduledEvents.push(event);
    // Sort events by date
    this.state.scheduledEvents.sort((a, b) =>
      GameCalendar.compareDates(a.date, b.date)
    );
  }

  /**
   * Register a callback for a specific event type
   */
  onEvent(eventType: string, callback: (event: ScheduledEvent) => void): void {
    this.eventCallbacks.set(eventType, callback);
  }

  /**
   * Get upcoming events (next N weeks)
   */
  getUpcomingEvents(weeksAhead: number = 4): ScheduledEvent[] {
    const futureDate = GameCalendar.addWeeks(this.state.currentDate, weeksAhead);
    return this.state.scheduledEvents.filter(event =>
      GameCalendar.isBefore(event.date, futureDate) ||
      GameCalendar.compareDates(event.date, futureDate) === 0
    );
  }

  /**
   * Pause/unpause time progression
   */
  setPaused(paused: boolean): void {
    this.state.isPaused = paused;
  }

  /**
   * Get full state (for saving/loading)
   */
  getState(): TimeSystemState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Restore state (for saving/loading)
   */
  setState(state: TimeSystemState): void {
    this.state = state;
  }
}

/**
 * Training/rest week result
 */
export interface WeeklyActivityResult {
  type: 'training' | 'match' | 'rest' | 'tournament';
  description: string;
  playerImpacts?: {
    playerId: string;
    skillChanges?: { [skill: string]: number };
    fatigueChange?: number;
    injuryRisk?: number;
  }[];
}

/**
 * Weekly Activity Simulator
 * Handles what happens during each week (training, rest, etc.)
 */
export class WeeklyActivitySimulator {
  /**
   * Simulate a week of training
   */
  static simulateTrainingWeek(
    playerIds: string[],
    trainingFocus: 'aim' | 'tactics' | 'utility' | 'balanced' = 'balanced'
  ): WeeklyActivityResult {
    const playerImpacts = playerIds.map(playerId => {
      const skillChanges: { [skill: string]: number } = {};

      // Skill improvements based on training focus
      switch (trainingFocus) {
        case 'aim':
          skillChanges.shooting = Math.random() * 2;
          skillChanges.crosshairPlacement = Math.random() * 2;
          skillChanges.reactionTime = Math.random() * 1;
          break;
        case 'tactics':
          skillChanges.positioning = Math.random() * 2;
          skillChanges.gameSense = Math.random() * 2;
          skillChanges.communication = Math.random() * 1;
          break;
        case 'utility':
          skillChanges.utilityUsage = Math.random() * 3;
          skillChanges.gameSense = Math.random() * 1;
          break;
        case 'balanced':
          skillChanges.shooting = Math.random() * 1;
          skillChanges.positioning = Math.random() * 1;
          skillChanges.utilityUsage = Math.random() * 1;
          skillChanges.communication = Math.random() * 0.5;
          break;
      }

      return {
        playerId,
        skillChanges,
        fatigueChange: Math.random() * 5, // Training causes some fatigue
        injuryRisk: Math.random() * 0.02, // 2% base injury risk during training
      };
    });

    return {
      type: 'training',
      description: `Completed ${trainingFocus} training week`,
      playerImpacts,
    };
  }

  /**
   * Simulate a rest week
   */
  static simulateRestWeek(playerIds: string[]): WeeklyActivityResult {
    const playerImpacts = playerIds.map(playerId => ({
      playerId,
      fatigueChange: -Math.random() * 15, // Recover 0-15 fatigue
      injuryRisk: 0,
    }));

    return {
      type: 'rest',
      description: 'Team rested and recovered',
      playerImpacts,
    };
  }
}
