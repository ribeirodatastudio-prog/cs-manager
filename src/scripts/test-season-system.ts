/**
 * Integration Example: Time Progression + Tournament System
 * Shows how to use these systems together in your CS Manager game
 */

import { TimeManager, GameCalendar, WeeklyActivitySimulator } from '../lib/season/time-system';
import { SeasonManager } from '../lib/season/season-calendar';
import { TournamentTier } from '../lib/season/tournament-system';
import { MatchSimulator } from '../lib/engine/MatchSimulator';

/**
 * Example: Initialize the game systems
 */
function initializeGame() {
  // Create the time manager
  const timeManager = new TimeManager(2025);

  // Create the season manager
  const seasonManager = new SeasonManager(2025, timeManager);

  // Get the season calendar
  const calendar = seasonManager.getCalendar();

  console.log('=== CS MANAGER - SEASON 2025 ===');
  console.log(`Total Tournaments: ${calendar.tournaments.length}`);
  console.log(`Current Date: ${GameCalendar.formatDate(timeManager.getCurrentDate())}`);

  // Show upcoming events
  const upcomingTournaments = seasonManager.getUpcomingTournaments(8);
  console.log('\n=== UPCOMING TOURNAMENTS (Next 8 Weeks) ===');
  upcomingTournaments.forEach(t => {
    console.log(`Week ${t.startDate.week}: ${t.name} (${t.tier})`);
    console.log(`  Duration: ${t.stages.reduce((sum, s) => sum + s.durationWeeks, 0)} weeks`);
    console.log(`  Prize Pool: $${t.prizePool.toLocaleString()}`);
  });

  return { timeManager, seasonManager };
}

/**
 * Example: Main game loop (advance one week)
 */
function advanceOneWeek(timeManager: TimeManager, seasonManager: SeasonManager) {
  console.log('\n=== ADVANCING TO NEXT WEEK ===');

  // 1. Check what tournaments are active this week
  const activeTournaments = seasonManager.getActiveTournaments();
  console.log(`Active Tournaments: ${activeTournaments.length}`);
  activeTournaments.forEach(t => {
    console.log(`  - ${t.name} (${t.currentStage})`);
  });

  // 2. Player chooses weekly activity
  // Options: Enter tournament, Train, Rest
  const playerChoice = 'train'; // In real game, this comes from UI

  if (playerChoice === 'train') {
    // Simulate training week
    const playerIds = ['player1', 'player2', 'player3', 'player4', 'player5'];
    const result = WeeklyActivitySimulator.simulateTrainingWeek(playerIds, 'aim');
    console.log(`\n${result.description}`);
    console.log('Player improvements:');
    result.playerImpacts?.forEach(impact => {
      // console.log(`  ${impact.playerId}:`);
      if (impact.skillChanges) {
        Object.entries(impact.skillChanges).forEach(([skill, change]) => {
          // console.log(`    ${skill}: +${change.toFixed(1)}`);
        });
      }
    });
    console.log("  (Skill changes applied hidden for brevity)");
  }

  // 3. Advance time by one week
  const events = timeManager.advanceWeek();
  console.log(`\nAdvanced to: ${GameCalendar.formatDate(timeManager.getCurrentDate())}`);
  console.log(`Events this week: ${events.length}`);

  // 4. Update tournament states
  seasonManager.updateTournaments();

  // 5. Show season summary
  const summary = seasonManager.getSeasonSummary();
  console.log('\n=== SEASON PROGRESS ===');
  console.log(`Tournaments completed: ${summary.completedTournaments}/${summary.totalTournaments}`);
  console.log(`Active tournaments: ${summary.activeTournaments}`);
  console.log(`Major progress: ${summary.majorProgress}`);
}

/**
 * Example: Tournament participation flow
 */
function participateInTournament(
  tournamentId: string,
  seasonManager: SeasonManager,
  timeManager: TimeManager
) {
  const calendar = seasonManager.getCalendar();
  const tournament = calendar.tournaments.find(t => t.id === tournamentId);

  if (!tournament) {
    console.log('Tournament not found!');
    return;
  }

  console.log(`\n=== ENTERING: ${tournament.name} ===`);
  console.log(`Tier: ${tournament.tier}`);
  console.log(`Prize Pool: $${tournament.prizePool.toLocaleString()}`);
  console.log(`Duration: ${tournament.stages.reduce((sum, s) => sum + s.durationWeeks, 0)} weeks`);

  // Show tournament stages
  console.log('\nTournament Structure:');
  tournament.stages.forEach((stage, index) => {
    console.log(`  Stage ${index + 1}: ${stage.stage}`);
    console.log(`    Format: ${stage.format}, Match Type: ${stage.matchFormat}`);
    console.log(`    Teams: ${stage.numberOfTeams}, Advancing: ${stage.numberOfAdvancing || 'N/A'}`);
    console.log(`    Duration: ${stage.durationWeeks} week(s)`);
  });

  // Simulate a match
  console.log("\n=== SIMULATING MATCH ===");
  const team1 = { id: "my-team", name: "My Team" };
  const team2 = { id: "enemy-team", name: "Enemy Team" };

  const result = MatchSimulator.simulate(team1, team2, {
      matchFormat: tournament.stages[0].matchFormat,
      maps: ["dust2", "mirage", "inferno"]
  });

  console.log(`Match Result: ${team1.name} ${result.team1Score} - ${result.team2Score} ${team2.name}`);
  console.log(`Winner: ${result.winnerId === team1.id ? team1.name : team2.name}`);
  console.log("Map Details:");
  result.mapResults.forEach(m => console.log(`  ${m.map}: ${m.score} (${m.winner === team1.id ? team1.name : team2.name})`));
}

/**
 * Example: View Major tournament details
 */
function viewMajorDetails(seasonManager: SeasonManager) {
  const calendar = seasonManager.getCalendar();
  const majors = calendar.tournaments.filter(t => t.tier === TournamentTier.MAJOR);

  console.log('\n=== 2025 MAJORS ===');
  majors.forEach(major => {
    console.log(`\n${major.name}`);
    console.log(`Dates: Week ${major.startDate.week} - Week ${major.endDate.week}`);
    console.log(`Prize Pool: $${major.prizePool.toLocaleString()}`);
    console.log(`Status: ${major.isCompleted ? 'Completed' : major.isActive ? 'Active' : 'Upcoming'}`);

    console.log('\nStages:');
    console.log('  1. Opening Stage (Week 1)');
    console.log('     - 16 Contenders/Challengers');
    console.log('     - Swiss System, BO1/BO3');
    console.log('     - Top 8 advance');

    console.log('  2. Elimination Stage (Week 2)');
    console.log('     - 8 from Opening + 8 Legends (16 teams)');
    console.log('     - Swiss System, BO3');
    console.log('     - Top 8 advance');

    console.log('  3. Champions Stage (Week 3)');
    console.log('     - Top 8 teams');
    console.log('     - Single-elimination bracket, BO3');
    console.log('     - Winner crowned Major Champion');
  });
}

/**
 * Example: Fast-forward to a specific tournament
 */
function fastForwardToTournament(
  tournamentName: string,
  timeManager: TimeManager,
  seasonManager: SeasonManager
) {
  const calendar = seasonManager.getCalendar();
  const tournament = calendar.tournaments.find(t =>
    t.name.toLowerCase().includes(tournamentName.toLowerCase())
  );

  if (!tournament) {
    console.log(`Tournament not found: ${tournamentName}`);
    return;
  }

  const currentDate = timeManager.getCurrentDate();
  let weeksToAdvance = 0;

  // Calculate weeks to advance
  if (tournament.startDate.year === currentDate.year) {
    weeksToAdvance = tournament.startDate.week - currentDate.week;
  } else {
    // Handle year transitions
    weeksToAdvance = (52 - currentDate.week) + tournament.startDate.week;
  }

  if (weeksToAdvance <= 0) {
    console.log('Tournament has already started or passed!');
    return;
  }

  console.log(`\nFast-forwarding ${weeksToAdvance} weeks to ${tournament.name}...`);

  // Simulate each week (in a real game, you might want to batch this)
  for (let i = 0; i < weeksToAdvance; i++) {
    timeManager.advanceWeek();
    seasonManager.updateTournaments();

    // Show progress every 4 weeks
    if ((i + 1) % 4 === 0) {
      console.log(`  Week ${i + 1}/${weeksToAdvance}...`);
    }
  }

  console.log(`Arrived at Week ${timeManager.getCurrentDate().week}!`);
  console.log(`${tournament.name} is ${tournament.isActive ? 'now active' : 'about to start'}!`);
}

/**
 * Example: Get tournament recommendations for player's team
 */
function getRecommendedTournaments(
  teamRanking: number, // 1-100 world ranking
  seasonManager: SeasonManager,
  timeManager: TimeManager
) {
  const upcomingTournaments = seasonManager.getUpcomingTournaments(8);

  console.log(`\n=== RECOMMENDED TOURNAMENTS (Your Ranking: #${teamRanking}) ===`);

  upcomingTournaments.forEach(tournament => {
    let canParticipate = false;
    let reason = '';

    // Determine if team can participate
    if (tournament.tier === TournamentTier.MAJOR) {
      if (teamRanking <= 24) {
        canParticipate = true;
        reason = teamRanking <= 8 ? 'Direct invite (Legend status)' : 'Must qualify';
      } else {
        reason = 'Team ranking too low';
      }
    } else if (tournament.tier === TournamentTier.TIER_1) {
      if (teamRanking <= 16) {
        canParticipate = true;
        reason = teamRanking <= 12 ? 'Direct invite' : 'Must qualify';
      } else {
        reason = 'Team ranking too low';
      }
    } else {
      canParticipate = true;
      reason = 'Open participation';
    }

    if (canParticipate) {
      console.log(`\n✓ ${tournament.name}`);
      console.log(`  Week ${tournament.startDate.week}, ${tournament.tier}`);
      console.log(`  Prize: $${tournament.prizePool.toLocaleString()}`);
      console.log(`  Entry: ${reason}`);
    }
  });
}

/**
 * Example: Run a complete season simulation
 */
function simulateCompleteSeason() {
  console.log('=== SIMULATING COMPLETE SEASON ===\n');

  const { timeManager, seasonManager } = initializeGame();

  let weekCount = 0;
  const maxWeeks = 52;

  while (weekCount < maxWeeks) {
    weekCount++;

    // Advance the game
    timeManager.advanceWeek();
    seasonManager.updateTournaments();

    // Report major milestones
    const activeTournaments = seasonManager.getActiveTournaments();
    const majorActive = activeTournaments.find(t => t.tier === TournamentTier.MAJOR);

    if (majorActive) {
      console.log(`\nWeek ${weekCount}: 🏆 MAJOR ACTIVE - ${majorActive.name}!`);
    } else if (weekCount % 8 === 0) {
      const summary = seasonManager.getSeasonSummary();
      console.log(`\nWeek ${weekCount}: ${summary.completedTournaments} tournaments completed, ${summary.activeTournaments} active`);
    }
  }

  const finalSummary = seasonManager.getSeasonSummary();
  console.log('\n=== SEASON COMPLETE ===');
  console.log(`Total tournaments: ${finalSummary.totalTournaments}`);
  console.log(`Completed: ${finalSummary.completedTournaments}`);
  console.log(`Majors completed: ${finalSummary.majorProgress}`);
}

// Execution Block
console.log('CS MANAGER - Time & Tournament System Examples\n');

// Example 1: Initialize and show calendar
const { timeManager, seasonManager } = initializeGame();

// Example 2: View major details
viewMajorDetails(seasonManager);

// Example 3: Advance a few weeks
for (let i = 0; i < 3; i++) {
  advanceOneWeek(timeManager, seasonManager);
}

// Example 4: Get tournament recommendations
getRecommendedTournaments(15, seasonManager, timeManager);

// Example 5: Simulate a match in an upcoming tournament
const upcoming = seasonManager.getUpcomingTournaments(4);
if (upcoming.length > 0) {
    participateInTournament(upcoming[0].id, seasonManager, timeManager);
}

// Example 6: Fast-forward (commented out in original, but let's run it)
// fastForwardToTournament('Spring Major', timeManager, seasonManager);

// Example 7: Full season sim (can take a while if logging is verbose, but instant here)
// simulateCompleteSeason();

export {
  initializeGame,
  advanceOneWeek,
  participateInTournament,
  viewMajorDetails,
  fastForwardToTournament,
  getRecommendedTournaments,
  simulateCompleteSeason,
};
