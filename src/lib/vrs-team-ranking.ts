/**
 * VRS (Valve Regional Standings) - Team Ranking System
 *
 * Used for CS2 Major qualification and tournament seeding.
 * Based on Valve's actual VRS methodology:
 * - Tournament prize money ("Bounty Offered")
 * - Strength of opponents defeated ("Bounty Collected")
 * - Opponent Network (consistency of opponents)
 * - Recent LAN tournament wins
 *
 * Rankings are updated weekly on Mondays.
 */

export interface Team {
  id: string;
  name: string;
  region: string;
  players: string[]; // Player IDs
  logo?: string;
}

export interface TournamentResult {
  tournamentId: string;
  tournamentName: string;
  placement: number; // 1st, 2nd, 3rd, etc.
  prizeMoney: number; // USD
  date: Date;
  isLAN: boolean;
  teamsAttended: number;
  defeatedTeams: Array<{
    teamId: string;
    teamVRSAtTime: number; // Their VRS rating when defeated
    round: string; // "Quarterfinals", "Semifinals", etc.
  }>;
}

export interface VRSRanking {
  teamId: string;
  points: number;
  rank: number;
  previousRank: number;
  bountyOffered: number; // From prize pools
  bountyCollected: number; // From defeating opponents
  opponentNetwork: number; // Quality/consistency of opponents
  lanWinBonus: number; // Recent LAN victories
  form: "rising" | "stable" | "falling";
  lastUpdated: Date;
}

/**
 * Calculate VRS points for a team based on tournament results
 *
 * VRS Formula (simplified):
 * Points = BountyOffered + BountyCollected + OpponentNetwork + LANBonus - Decay
 */
export function calculateVRSPoints(
  teamResults: TournamentResult[],
  currentDate: Date = new Date()
): VRSRanking {
  let bountyOffered = 0;
  let bountyCollected = 0;
  let opponentNetwork = 0;
  let lanWinBonus = 0;

  // Sort results by date (most recent first)
  const sortedResults = [...teamResults].sort((a, b) => b.date.getTime() - a.date.getTime());

  sortedResults.forEach((result) => {
    const daysSince = Math.floor(
      (currentDate.getTime() - result.date.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Decay factor: points lose value over time
    // Linear decay over 90 days (Valve uses ~3 months rolling window)
    const decayFactor = Math.max(0, 1 - daysSince / 90);

    // 1. BOUNTY OFFERED: Prize money from tournaments
    // Higher placements = more points from prize pool
    const placementMultiplier = getPlacementMultiplier(result.placement, result.teamsAttended);
    const tournamentPoints = (result.prizeMoney / 1000) * placementMultiplier;
    bountyOffered += tournamentPoints * decayFactor;

    // 2. BOUNTY COLLECTED: Points from defeating strong opponents
    result.defeatedTeams.forEach((opponent) => {
      // Defeating higher-rated teams gives more points
      const opponentValue = opponent.teamVRSAtTime / 100; // Normalize
      const roundMultiplier = getRoundImportance(opponent.round);
      bountyCollected += opponentValue * roundMultiplier * decayFactor;
    });

    // 3. OPPONENT NETWORK: Consistency of playing against good teams
    // More varied, high-quality opponents = better network score
    const avgOpponentStrength = result.defeatedTeams.length > 0
      ? result.defeatedTeams.reduce((sum, opp) => sum + opp.teamVRSAtTime, 0) / result.defeatedTeams.length
      : 0;
    opponentNetwork += (avgOpponentStrength / 200) * decayFactor;

    // 4. LAN WIN BONUS: Recent LAN tournament victories
    if (result.isLAN && result.placement === 1 && daysSince <= 60) {
      // Winning a LAN in last 2 months = significant boost
      const tierMultiplier = getTournamentTier(result.prizeMoney, result.teamsAttended);
      lanWinBonus += 500 * tierMultiplier * decayFactor;
    }
  });

  const totalPoints = bountyOffered + bountyCollected + opponentNetwork + lanWinBonus;

  return {
    teamId: "", // Set by caller
    points: Math.round(totalPoints),
    rank: 0, // Calculated when comparing all teams
    previousRank: 0,
    bountyOffered: Math.round(bountyOffered),
    bountyCollected: Math.round(bountyCollected),
    opponentNetwork: Math.round(opponentNetwork),
    lanWinBonus: Math.round(lanWinBonus),
    form: "stable",
    lastUpdated: currentDate,
  };
}

/**
 * Get multiplier based on tournament placement
 */
function getPlacementMultiplier(placement: number, _totalTeams: number): number {
  // 1st place gets full prize pool credit
  // Lower placements get proportionally less
  if (placement === 1) return 1.0;
  if (placement === 2) return 0.7;
  if (placement <= 4) return 0.5;
  if (placement <= 8) return 0.3;
  if (placement <= 16) return 0.15;
  return 0.05;
}

/**
 * Get importance multiplier based on playoff round
 */
function getRoundImportance(round: string): number {
  const roundLower = round.toLowerCase();

  if (roundLower.includes("final") && !roundLower.includes("semi")) return 2.0; // Grand Finals
  if (roundLower.includes("semi")) return 1.5; // Semifinals
  if (roundLower.includes("quarter")) return 1.2; // Quarterfinals
  if (roundLower.includes("playoff") || roundLower.includes("bracket")) return 1.0;
  return 0.7; // Group stage
}

/**
 * Determine tournament tier based on prize pool and attendance
 */
function getTournamentTier(prizeMoney: number, teamsAttended: number): number {
  // S-Tier: Major, $1M+ prize pool, 16+ teams
  if (prizeMoney >= 1000000 && teamsAttended >= 16) return 3.0;

  // A-Tier: $250k+, 12+ teams
  if (prizeMoney >= 250000 && teamsAttended >= 12) return 2.0;

  // B-Tier: $100k+, 8+ teams
  if (prizeMoney >= 100000 && teamsAttended >= 8) return 1.5;

  // C-Tier: Everything else
  return 1.0;
}

/**
 * Calculate rankings for all teams and assign positions
 */
export function calculateVRSRankings(
  teams: Array<{ team: Team; results: TournamentResult[] }>,
  currentDate: Date = new Date()
): VRSRanking[] {
  // Calculate points for each team
  const rankings = teams.map(({ team, results }) => {
    const vrs = calculateVRSPoints(results, currentDate);
    vrs.teamId = team.id;
    return vrs;
  });

  // Sort by points (highest first)
  rankings.sort((a, b) => b.points - a.points);

  // Assign ranks
  rankings.forEach((ranking, index) => {
    ranking.rank = index + 1;

    // Determine form based on rank change
    if (ranking.rank < ranking.previousRank) {
      ranking.form = "rising";
    } else if (ranking.rank > ranking.previousRank) {
      ranking.form = "falling";
    } else {
      ranking.form = "stable";
    }
  });

  return rankings;
}

/**
 * Get VRS tier/region qualification status
 */
export function getVRSTier(rank: number, _region: string): {
  tier: string;
  qualificationStatus: string;
  color: string;
} {
  // Major qualification thresholds (varies by region)
  if (rank <= 8) {
    return {
      tier: "Legends",
      qualificationStatus: "Direct Major Invite",
      color: "#FFD700",
    };
  }

  if (rank <= 16) {
    return {
      tier: "Challengers",
      qualificationStatus: "Major RMR Qualified",
      color: "#C0C0C0",
    };
  }

  if (rank <= 32) {
    return {
      tier: "Contenders",
      qualificationStatus: "Regional Qualifier",
      color: "#CD7F32",
    };
  }

  return {
    tier: "Open",
    qualificationStatus: "Open Qualifiers",
    color: "#888888",
  };
}

/**
 * Generate mock tournament results for testing
 */
export function generateMockTournamentResult(
  tournamentTier: "S" | "A" | "B" | "C",
  placement: number,
  weeksAgo: number = 0
): TournamentResult {
  const tierData = {
    S: { prize: 1000000, teams: 24, name: "Major Championship" },
    A: { prize: 500000, teams: 16, name: "Premier Tournament" },
    B: { prize: 250000, teams: 12, name: "Elite Series" },
    C: { prize: 100000, teams: 8, name: "Regional Championship" },
  };

  const tier = tierData[tournamentTier];
  const date = new Date();
  date.setDate(date.getDate() - weeksAgo * 7);

  return {
    tournamentId: `tournament-${Date.now()}`,
    tournamentName: tier.name,
    placement,
    prizeMoney: tier.prize,
    date,
    isLAN: Math.random() > 0.3, // 70% LAN
    teamsAttended: tier.teams,
    defeatedTeams: Array.from({ length: Math.min(placement - 1, 5) }, (_, i) => ({
      teamId: `team-${i}`,
      teamVRSAtTime: 1000 + Math.random() * 500,
      round: i === 0 ? "Grand Finals" : i === 1 ? "Semifinals" : "Quarterfinals",
    })),
  };
}

/**
 * Example: Generate VRS standings for top teams
 */
export function generateExampleVRSStandings(): VRSRanking[] {
  const exampleTeams = [
    { id: "team-1", name: "FaZe Clan", results: [
      generateMockTournamentResult("S", 1, 2),
      generateMockTournamentResult("A", 2, 4),
      generateMockTournamentResult("S", 3, 8),
    ]},
    { id: "team-2", name: "Natus Vincere", results: [
      generateMockTournamentResult("S", 2, 2),
      generateMockTournamentResult("A", 1, 3),
      generateMockTournamentResult("B", 1, 6),
    ]},
    { id: "team-3", name: "Team Vitality", results: [
      generateMockTournamentResult("A", 1, 1),
      generateMockTournamentResult("S", 5, 3),
      generateMockTournamentResult("B", 2, 5),
    ]},
  ];

  const teams = exampleTeams.map(t => ({
    team: { id: t.id, name: t.name, region: "EU", players: [] },
    results: t.results,
  }));

  return calculateVRSRankings(teams);
}
