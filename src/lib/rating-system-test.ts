import {
  calculateOverallRating,
  getRatingTier,
  calculateHLTVRating,
  getHLTVRatingTier,
  generateMockMatchStats,
  calculateForm
} from "@/lib/rating-system";

import {
  getVRSTier,
  generateExampleVRSStandings
} from "@/lib/vrs-team-ranking";

import { Player } from "@/types";

export function testRatingSystem() {
  console.log("=== Testing Player Rating System ===\n");

  // 1. Test Overall Rating
  const mockPlayer: Player = {
    id: "player-1",
    name: "ZywOo",
    age: 23,
    nationality: "France",
    role: "Star AWPer",
    skills: {
      technical: {
        shooting: 195,
        crosshairPlacement: 190,
        sprayControl: 180,
        utilityUsage: 170,
        utility: 170,
        firstBulletPrecision: 198,
        movement: 185,
        clutching: 195,
      },
      mental: {
        positioning: 195,
        adaptability: 190,
        composure: 195,
        communication: 160,
        gameSense: 198,
        aggression: 160,
      },
      physical: {
        reactionTime: 198,
        dexterity: 190,
        consistency: 195,
        injuryResistance: 180,
      },
    }
  };

  const rating = calculateOverallRating(mockPlayer);
  const tier = getRatingTier(rating);

  console.log(`Player: ${mockPlayer.name}`);
  console.log(`Role: ${mockPlayer.role}`);
  console.log(`Overall Rating: ${rating}/200`);
  console.log(`Tier: ${tier.tier} (${tier.description})\n`);

  // 2. Test HLTV Rating
  console.log("=== Testing HLTV Rating 2.0 ===\n");

  const mockStats = generateMockMatchStats(rating);
  // Override slightly to ensure consistent output for demo
  mockStats.kills = 24;
  mockStats.deaths = 12;
  mockStats.roundsPlayed = 24;
  mockStats.impactRating = 1.45;
  mockStats.adr = 95;

  const hltvRating = calculateHLTVRating(mockStats);
  const hltvTier = getHLTVRatingTier(hltvRating);

  console.log(`Match Stats: ${mockStats.kills}K/${mockStats.deaths}D (${mockStats.adr} ADR)`);
  console.log(`HLTV Rating: ${hltvRating}`);
  console.log(`Performance: ${hltvTier.tier} (${hltvTier.description})\n`);

  // 3. Test Form
  console.log("=== Testing Form System ===\n");

  const recentRatings = [1.32, 1.45, 1.15, 1.28, 1.50];
  const form = calculateForm(recentRatings, rating);

  console.log(`Recent Ratings: ${recentRatings.join(", ")}`);
  console.log(`Form Score: ${form.form}%`);
  console.log(`Trend: ${form.trend}`);
  console.log(`Status: ${form.description}\n`);

  // 4. Test VRS Team Ranking
  console.log("=== Testing VRS Team Ranking ===\n");

  const rankings = generateExampleVRSStandings();

  console.log("Top 3 Teams:");
  rankings.slice(0, 3).forEach((rank) => {
    // We don't have team names in the ranking object directly (it has teamId),
    // but for this test we know the mock generator order or we can just print ID/Points.
    // Actually generateExampleVRSStandings uses "team-1", "team-2", "team-3" mapped to FaZe, NaVi, Vitality in order.
    // The ranking array is sorted by points.

    // Let's resolve name roughly for display or just show ID
    const nameMap: Record<string, string> = {
      "team-1": "FaZe Clan",
      "team-2": "Natus Vincere",
      "team-3": "Team Vitality"
    };
    const teamName = nameMap[rank.teamId] || rank.teamId;
    const vrsTier = getVRSTier(rank.rank, "EU");

    console.log(`#${rank.rank} ${teamName}: ${rank.points} pts`);
    console.log(`   Status: ${vrsTier.qualificationStatus}`);
    console.log(`   LAN Bonus: ${rank.lanWinBonus}`);
    console.log(`   Form: ${rank.form}`);
  });
}

// Execute if run directly
if (require.main === module) {
  testRatingSystem();
}
