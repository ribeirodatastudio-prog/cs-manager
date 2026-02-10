import { Player, MatchStats } from "@/types";

/**
 * CS Manager Rating System
 * Overall Rating: 1-200 scale combining all player attributes
 * 200 = ZywOo level (GOAT tier)
 * 100 = 10k Premier ELO (solid semi-pro)
 * 40 = 4k Premier ELO (decent casual player)
 * 1 = Never touched CS
 *
 * HLTV Rating 2.0: Performance-based rating calculated from match stats
 * Similar to the real HLTV Rating 2.0 used in professional CS
 * 1.0 = average professional performance
 * 1.20 = excellent/star player performance
 * <0.80 = below average performance
 */

interface SkillWeights {
  [key: string]: number;
}

interface RoleWeightProfile {
  technical: SkillWeights;
  mental: SkillWeights;
  physical: SkillWeights;
}

interface RoleWeightsMap {
  [role: string]: RoleWeightProfile;
}

// Role-specific weight profiles
// These determine which skills matter most for each role
const ROLE_WEIGHTS: RoleWeightsMap = {
  "Entry Fragger": {
    technical: {
      shooting: 1.3,
      crosshairPlacement: 1.2,
      sprayControl: 1.1,
      firstBulletPrecision: 1.3,
      movement: 1.2,
      clutching: 0.8,
      utilityUsage: 0.7,
    },
    mental: {
      positioning: 0.9,
      adaptability: 1.0,
      composure: 1.1,
      communication: 0.9,
      gameSense: 1.0,
      aggression: 1.4, // Entry fraggers need high aggression
    },
    physical: {
      reactionTime: 1.3,
      dexterity: 1.2,
      consistency: 1.0,
      injuryResistance: 0.8,
    },
  },
  "Support": {
    technical: {
      shooting: 0.9,
      crosshairPlacement: 1.0,
      sprayControl: 0.9,
      firstBulletPrecision: 1.0,
      movement: 1.0,
      clutching: 1.0,
      utilityUsage: 1.5, // Support players excel at utility
    },
    mental: {
      positioning: 1.3,
      adaptability: 1.2,
      composure: 1.1,
      communication: 1.4, // Communication critical for support
      gameSense: 1.3,
      aggression: 0.7,
    },
    physical: {
      reactionTime: 1.0,
      dexterity: 1.0,
      consistency: 1.1,
      injuryResistance: 0.9,
    },
  },
  "IGL": {
    technical: {
      shooting: 0.8,
      crosshairPlacement: 0.9,
      sprayControl: 0.8,
      firstBulletPrecision: 0.9,
      movement: 0.9,
      clutching: 1.2,
      utilityUsage: 1.3,
    },
    mental: {
      positioning: 1.4,
      adaptability: 1.5, // IGLs need to adapt constantly
      composure: 1.4,
      communication: 1.6, // Most important for IGL
      gameSense: 1.6, // Reading the game is crucial
      aggression: 0.8,
    },
    physical: {
      reactionTime: 0.9,
      dexterity: 0.9,
      consistency: 1.2,
      injuryResistance: 1.0,
    },
  },
  "Lurker": {
    technical: {
      shooting: 1.2,
      crosshairPlacement: 1.3,
      sprayControl: 1.0,
      firstBulletPrecision: 1.3,
      movement: 1.3, // Lurkers need quiet movement
      clutching: 1.4, // Often in clutch situations
      utilityUsage: 0.9,
    },
    mental: {
      positioning: 1.5, // Positioning is everything for lurkers
      adaptability: 1.2,
      composure: 1.4, // Need nerves of steel
      communication: 1.0,
      gameSense: 1.4,
      aggression: 1.1,
    },
    physical: {
      reactionTime: 1.2,
      dexterity: 1.1,
      consistency: 1.2,
      injuryResistance: 0.9,
    },
  },
  "Star AWPer": {
    technical: {
      shooting: 1.5, // AWP shooting is different but critical
      crosshairPlacement: 1.4,
      sprayControl: 0.6, // Less relevant for AWP
      firstBulletPrecision: 1.6, // ONE shot matters
      movement: 1.2,
      clutching: 1.2,
      utilityUsage: 0.8,
    },
    mental: {
      positioning: 1.5, // AWPers need perfect positioning
      adaptability: 1.1,
      composure: 1.3,
      communication: 1.0,
      gameSense: 1.3,
      aggression: 1.2,
    },
    physical: {
      reactionTime: 1.5, // Flick shots require insane reactions
      dexterity: 1.4,
      consistency: 1.3, // AWPers can't have off-days
      injuryResistance: 0.9,
    },
  },
};

// Default weights if role not found
const DEFAULT_WEIGHTS: RoleWeightProfile = {
  technical: {
    shooting: 1.0,
    crosshairPlacement: 1.0,
    sprayControl: 1.0,
    firstBulletPrecision: 1.0,
    movement: 1.0,
    clutching: 1.0,
    utilityUsage: 1.0,
  },
  mental: {
    positioning: 1.0,
    adaptability: 1.0,
    composure: 1.0,
    communication: 1.0,
    gameSense: 1.0,
    aggression: 1.0,
  },
  physical: {
    reactionTime: 1.0,
    dexterity: 1.0,
    consistency: 1.0,
    injuryResistance: 1.0,
  },
};

/**
 * Calculate a player's overall rating (1-200)
 * This is similar to Football Manager's Current Ability
 */
export function calculateOverallRating(player: Player): number {
  const weights = ROLE_WEIGHTS[player.role] || DEFAULT_WEIGHTS;

  let totalWeightedScore = 0;
  let totalWeight = 0;

  // Technical skills (40% of overall rating)
  const technicalSkills = player.skills.technical;
  for (const [skill, value] of Object.entries(technicalSkills)) {
    if (skill === 'utility') continue; // Skip duplicate or legacy field if present

    // Use type assertion carefully or index access safely
    const weight = weights.technical[skill] || 1.0;
    totalWeightedScore += value * weight * 0.4;
    totalWeight += weight * 0.4;
  }

  // Mental skills (40% of overall rating)
  const mentalSkills = player.skills.mental;
  for (const [skill, value] of Object.entries(mentalSkills)) {
    const weight = weights.mental[skill] || 1.0;
    totalWeightedScore += value * weight * 0.4;
    totalWeight += weight * 0.4;
  }

  // Physical skills (20% of overall rating)
  const physicalSkills = player.skills.physical;
  for (const [skill, value] of Object.entries(physicalSkills)) {
    const weight = weights.physical[skill] || 1.0;
    totalWeightedScore += value * weight * 0.2;
    totalWeight += weight * 0.2;
  }

  // Calculate average weighted score
  // If totalWeight is somehow 0, avoid division by zero
  if (totalWeight === 0) return 50;

  const rawRating = totalWeightedScore / totalWeight;

  // Round to nearest integer and clamp between 1-200
  return Math.max(1, Math.min(200, Math.round(rawRating)));
}

/**
 * Get a player's rating tier/description
 */
export function getRatingTier(rating: number): { tier: string; description: string; color: string; } {
  if (rating >= 190) return { tier: "GOAT", description: "Generational Talent", color: "#FFD700" };
  if (rating >= 170) return { tier: "S-Tier", description: "World Class", color: "#FF4444" };
  if (rating >= 150) return { tier: "A-Tier", description: "Elite Professional", color: "#FF8844" };
  if (rating >= 130) return { tier: "B-Tier", description: "Top Professional", color: "#FFBB44" };
  if (rating >= 110) return { tier: "C-Tier", description: "Professional", color: "#44FF44" };
  if (rating >= 90) return { tier: "D-Tier", description: "Semi-Professional", color: "#44BBFF" };
  if (rating >= 70) return { tier: "E-Tier", description: "High Amateur", color: "#8844FF" };
  if (rating >= 50) return { tier: "F-Tier", description: "Amateur", color: "#BBBBBB" };
  if (rating >= 30) return { tier: "G-Tier", description: "Casual Player", color: "#888888" };
  return { tier: "Beginner", description: "Learning the Game", color: "#666666" };
}

/**
 * Calculate HLTV Rating 2.0
 * HLTV Rating 2.0 is based on:
 * Impact (multi-kills, opening kills, clutches): Heavily weighted
 * Kill/Death Ratio: Core metric
 * Survival rate: Staying alive matters
 * Damage per round: Contribution even without kills
 * KAST% (Kill, Assist, Survived, Traded): Consistency metric
 *
 * Formula breakdown (HLTV's actual methodology):
 * Base KPR (Kills per Round) with adjustments for impact
 * Survival bonus (rounds survived / total rounds)
 * Multi-kill rounds bonus (2k, 3k, 4k, ace impact)
 * KAST consistency factor
 * ADR (Average Damage per Round) normalized
 *
 * Returns: Rating typically between 0.5 - 1.5
 * 1.0 = average pro player
 * 1.20+ = star/elite player
 * 0.80- = struggling player
 */
export function calculateHLTVRating(stats: MatchStats): number {
  if (stats.roundsPlayed === 0) return 0;

  // Core stats
  const kpr = stats.kills / stats.roundsPlayed;
  const dpr = stats.deaths / stats.roundsPlayed;
  const survivalRate = (stats.roundsPlayed - stats.deaths) / stats.roundsPlayed;

  // HLTV 2.0 methodology:
  // Start with KPR, heavily penalize deaths, add impact factors
  let rating = kpr;

  // Death penalty (dying frequently is heavily penalized in HLTV 2.0)
  rating -= dpr * 0.7;

  // Survival bonus
  rating += survivalRate * 0.25;

  // Impact rating (opening kills, multi-kills, clutches)
  // This is the most important factor in HLTV 2.0
  const impactBonus = stats.impactRating * 0.35;
  rating += impactBonus;

  // KAST bonus (consistency metric)
  const kastBonus = (stats.kast / 100) * 0.15;
  rating += kastBonus;

  // ADR factor (85 ADR is average for pros)
  const adrFactor = ((stats.adr - 85) / 85) * 0.15;
  rating += adrFactor;

  // Clutch performance
  if (stats.clutchesAttempted > 0) {
    const clutchRate = stats.clutchesWon / stats.clutchesAttempted;
    rating += clutchRate * 0.1;
  }

  // Utility impact
  const utilityBonus = (
    (stats.utilityDamage / stats.roundsPlayed / 20) * 0.05 +
    (stats.enemiesFlashed / stats.roundsPlayed / 2) * 0.05
  );
  rating += utilityBonus;

  // HLTV 2.0 typically: 0.5-1.5 range, 1.0 = average, 1.20+ = star
  const clampedRating = Math.max(0.3, Math.min(2.0, rating));

  return Math.round(clampedRating * 100) / 100;
}

/**
 * Get HLTV Rating performance tier
 */
export function getHLTVRatingTier(rating: number): { tier: string; description: string; color: string; } {
  if (rating >= 1.4) return { tier: "Elite", description: "Superstar Performance", color: "#FFD700" };
  if (rating >= 1.2) return { tier: "Excellent", description: "Exceptional Performance", color: "#FF4444" };
  if (rating >= 1.05) return { tier: "Good", description: "Above Average", color: "#44FF44" };
  if (rating >= 0.95) return { tier: "Average", description: "Solid Performance", color: "#FFBB44" };
  if (rating >= 0.8) return { tier: "Below Average", description: "Underperforming", color: "#FF8844" };
  return { tier: "Poor", description: "Struggling", color: "#888888" };
}

/**
 * Calculate expected HLTV Rating based on player's overall rating
 * This helps determine if a player is over/underperforming
 */
export function getExpectedHLTVRating(overallRating: number): number {
  // Map overall rating to expected HLTV Rating
  // 200 rating -> ~1.4 HLTV Rating (elite)
  // 100 rating -> ~1.0 HLTV Rating (average pro)
  // 40 rating -> ~0.6 HLTV Rating (casual)
  // 1 rating -> ~0.3 HLTV Rating (beginner)

  const expectedHLTVRating = 0.3 + ((overallRating - 1) / 199) * 1.1;
  return Math.round(expectedHLTVRating * 100) / 100;
}

/**
 * Calculate form (recent performance trend)
 * Compares recent HLTV Rating to expected HLTV Rating based on rating
 */
export function calculateForm(
  recentHLTVRating: number[], // Last 5-10 matches
  overallRating: number
): {
  form: number; // -100 to +100
  trend: "improving" | "stable" | "declining";
  description: string;
} {
  if (recentHLTVRating.length === 0) {
    return { form: 0, trend: "stable", description: "No recent matches" };
  }

  const avgRecentHLTVRating = recentHLTVRating.reduce((a, b) => a + b, 0) / recentHLTVRating.length;
  const expectedHLTVRating = getExpectedHLTVRating(overallRating);

  // Form is percentage above/below expected
  // Avoid division by zero if expected is somehow 0
  const expected = expectedHLTVRating || 0.3;
  const formPercentage = ((avgRecentHLTVRating - expected) / expected) * 100;
  const form = Math.max(-100, Math.min(100, Math.round(formPercentage)));

  // Determine trend from last few matches
  let trend: "improving" | "stable" | "declining" = "stable";
  if (recentHLTVRating.length >= 3) {
    const firstHalf = recentHLTVRating.slice(0, Math.floor(recentHLTVRating.length / 2));
    const secondHalf = recentHLTVRating.slice(Math.floor(recentHLTVRating.length / 2));

    const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
    const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;

    if (secondAvg > firstAvg * 1.05) trend = "improving";
    else if (secondAvg < firstAvg * 0.95) trend = "declining";
  }

  let description = "Average form";
  if (form >= 20) description = "Excellent form";
  else if (form >= 10) description = "Good form";
  else if (form <= -20) description = "Poor form";
  else if (form <= -10) description = "Below par";

  return { form, trend, description };
}

/**
 * Helper to generate mock match stats for testing
 */
export function generateMockMatchStats(playerRating: number): MatchStats {
  const roundsPlayed = 24;
  const expectedKPR = (playerRating / 100) * 0.75; // 150 rating = ~1.125 KPR

  return {
    kills: Math.round(Math.max(0, expectedKPR * roundsPlayed + (Math.random() - 0.5) * 5)),
    deaths: Math.round(Math.max(0, roundsPlayed * 0.8 + (Math.random() - 0.5) * 4)),
    assists: Math.round(Math.max(0, roundsPlayed * 0.2 + (Math.random() - 0.5) * 3)),
    kast: Math.min(100, Math.max(0, 65 + Math.random() * 25)),
    adr: Math.max(0, 60 + (playerRating / 200) * 50 + (Math.random() - 0.5) * 15),
    impactRating: Math.max(0, 0.8 + (playerRating / 200) * 1.2),
    clutchesWon: Math.floor(Math.random() * 3),
    clutchesAttempted: Math.floor(Math.random() * 5),
    utilityDamage: Math.round(Math.max(0, roundsPlayed * 15 + (Math.random() - 0.5) * 100)),
    enemiesFlashed: Math.round(Math.max(0, roundsPlayed * 0.5 + (Math.random() - 0.5) * 5)),
    roundsPlayed,
  };
}
