/**
 * Defines the structure for Technical Skills.
 * All values are integers from 1 to 200.
 */
export interface TechnicalSkills {
  shooting: number;
  crosshairPlacement: number;
  sprayControl: number;
  utilityUsage: number;
  utility: number; // For compatibility, or rename usage to utility in implementation
  firstBulletPrecision: number;
  movement: number;
  clutching: number;
}

/**
 * Defines the structure for Mental Skills.
 * All values are integers from 1 to 200.
 */
export interface MentalSkills {
  positioning: number;
  adaptability: number;
  composure: number;
  communication: number;
  gameSense: number; // Ability to predict and react
  aggression: number; // Trait, indicates playstyle preference
}

/**
 * Defines the structure for Physical Skills.
 * All values are integers from 1 to 200.
 */
export interface PhysicalSkills {
  reactionTime: number;
  dexterity: number;
  consistency: number;
  injuryResistance: number;
}

/**
 * Represents a Player entity in the game.
 */
export interface Player {
  id: string;
  name: string;
  age: number;
  nationality: string; // ISO code or Country Name
  role: string; // The player's primary role in the team
  avatar?: string; // Optional URL for player image
  skills: {
    technical: TechnicalSkills;
    mental: MentalSkills;
    physical: PhysicalSkills;
  };
  // Runtime State (Optional for mocks, required for simulation)
  health?: number;
  hasHelmet?: boolean;
  hasVest?: boolean;
  inventory?: PlayerInventory;
}

export interface PlayerInventory {
  money: number;
  primaryWeapon?: string; // Weapon ID
  secondaryWeapon?: string; // Weapon ID
  hasKevlar: boolean;
  hasHelmet: boolean;
  hasDefuseKit: boolean; // Renamed from hasKit
  grenades: string[]; // Renamed from utilities
}

/**
 * Match stats used for HLTV Rating calculation
 */
export interface MatchStats {
  kills: number;
  deaths: number;
  assists: number;
  kast: number; // Kill, Assist, Survived, Traded % (0-100)
  adr: number; // Average Damage per Round
  impactRating: number; // Opening kills, multi-kills impact (0-2+)
  clutchesWon: number;
  clutchesAttempted: number;
  utilityDamage: number;
  enemiesFlashed: number;
  roundsPlayed: number;
}
