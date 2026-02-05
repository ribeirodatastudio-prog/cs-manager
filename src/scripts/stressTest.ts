
import { MatchSimulator } from "../lib/engine/MatchSimulator";
import { generateTeam } from "../lib/player-generator";
import { TeamSide, Tactic } from "../lib/engine/TacticsManager";
import { MatchPhase, RoundEndReason, BuyStrategy } from "../lib/engine/types";
import * as fs from 'fs';

// Constants
const TARGET_ROUNDS = 5000;

// Stats Containers
const stats = {
  totalRounds: 0,
  tWins: 0,
  ctWins: 0,
  winTypes: {} as Record<string, number>,
  weaponKills: {} as Record<string, number>,
  totalKills: 0,
  tradedKills: 0,
  siteStats: {
    A: { attempts: 0, wins: 0 },
    B: { attempts: 0, wins: 0 }
  },
  heroRounds: [] as { roundId: number, matchRound: number, playerId: string, playerName: string, kills: number, weapon: string }[]
};

// Tactics
const T_TACTICS: Tactic[] = [
  "RUSH_A", "RUSH_B", "EXECUTE_A", "EXECUTE_B",
  "CONTACT_A", "CONTACT_B", "SPLIT_A", "SPLIT_B", "DEFAULT"
];
const CT_TACTICS: Tactic[] = [
  "STANDARD", "AGGRESSIVE_PUSH", "GAMBLE_STACK_A", "GAMBLE_STACK_B", "RETAKE_SETUP"
];
const BUY_STRATEGIES: BuyStrategy[] = ["ECO", "FORCE", "FULL", "HALF", "BONUS", "HERO"];

// Helper to pick random item
const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Kill Tracking for Trade Logic
interface KillEvent {
  killerId: string;
  victimId: string;
  killerSide: TeamSide;
  victimSide: TeamSide;
  tick: number;
}
let roundKills: KillEvent[] = [];

// Player Kills this round (for Hero check)
let playerRoundKills: Record<string, number> = {};

// Initialize Simulator
// We use a dummy update function as we run headless
const roster = generateTeam(10, 1);
const sim = new MatchSimulator(roster, () => {});

// Add tick override to suppress logging? No, we need logging to parsing events.
// But we can just use sim.events.

console.log(`Starting stress test for ${TARGET_ROUNDS} rounds...`);

let globalRoundCounter = 0;

// Helper to determine Site
function getSiteFromTactic(tactic: Tactic): "A" | "B" | null {
  if (tactic.includes("_A")) return "A";
  if (tactic.includes("_B")) return "B";
  return null; // DEFAULT or STANDARD etc
}

while (globalRoundCounter < TARGET_ROUNDS) {
    // 1. Start Round Logic
    // If we are at MATCH_END or just started, we reset.
    if (sim.matchState.phase === MatchPhase.MATCH_END || sim.matchState.phase === MatchPhase.WARMUP) {
        sim.reset();
        // Reset calls startRound implicitly, putting us in PAUSED_FOR_STRATEGY
    } else if (sim.matchState.phase === MatchPhase.ROUND_END) {
        sim.nextRound();
    }

    // Now in PAUSED_FOR_STRATEGY
    const tTactic = randomItem(T_TACTICS);
    const ctTactic = randomItem(CT_TACTICS);

    // Pick Buy Strategy based on logic or random?
    // Let's use random to cover all cases as requested,
    // although "ECO" when you have 16k is weird, BuyLogic might handle it?
    // BuyLogic.processBuy: if strategy provided, it follows it.
    // If we want "realistic" stress test, we should let BuyLogic decide (pass undefined).
    // But user said "Randomize T and CT strategies".
    // I will randomize Buy Strategy too, but maybe weight it?
    // Let's just random it to stress test edge cases (Full buy vs Eco etc).
    const tBuy = randomItem(BUY_STRATEGIES);
    const ctBuy = randomItem(BUY_STRATEGIES);

    sim.applyStrategies(tBuy, tTactic, ctBuy, ctTactic);

    // Reset Round Trackers
    roundKills = [];
    playerRoundKills = {};
    roster.forEach(p => playerRoundKills[p.id] = 0);

    // Run Round
    let roundEnded = false;
    let loopGuard = 0;

    while (!roundEnded && loopGuard < 10000) { // 1000 seconds max
        const prevEventsLen = sim.events.length;
        sim.tick();

        // Harvest New Events
        // sim.events is unshifted (newest at 0).
        // New events are sim.events[0] ... sim.events[newLen - prevLen - 1]
        const newEventCount = sim.events.length - prevEventsLen;
        for (let i = newEventCount - 1; i >= 0; i--) {
            const event = sim.events[i];

            // Parse Kill: 💀 [Weapon] Loser eliminated by Winner (+$Reward)
            if (event.startsWith("💀")) {
                const match = event.match(/💀 \[(.*?)\] (.*?) eliminated by (.*?) \(/);
                if (match) {
                    const weapon = match[1];
                    const victimName = match[2];
                    const killerName = match[3];

                    // Map names to IDs
                    const victim = sim.bots.find(b => b.player.name === victimName);
                    const killer = sim.bots.find(b => b.player.name === killerName);

                    if (victim && killer) {
                        roundKills.push({
                            killerId: killer.id,
                            victimId: victim.id,
                            killerSide: killer.side,
                            victimSide: victim.side,
                            tick: sim.tickCount
                        });

                        playerRoundKills[killer.id] = (playerRoundKills[killer.id] || 0) + 1;

                        // Weapon Stats
                        stats.weaponKills[weapon] = (stats.weaponKills[weapon] || 0) + 1;
                        stats.totalKills++;
                    }
                }
            }
        }

        if (sim.matchState.phase === MatchPhase.ROUND_END || sim.matchState.phase === MatchPhase.MATCH_END) {
            roundEnded = true;
        }
        loopGuard++;
    }

    // Round Analysis
    const history = sim.matchState.roundHistory[sim.matchState.roundHistory.length - 1];
    if (history) {
        // Win Rate
        if (history.winner === TeamSide.T) stats.tWins++;
        else stats.ctWins++;

        // Win Type
        stats.winTypes[history.reason] = (stats.winTypes[history.reason] || 0) + 1;

        // Site Success
        // Determine attempted site
        let site: "A" | "B" | null = getSiteFromTactic(tTactic);

        // Augment with Plant Location
        // If bomb was planted/defused/detonated, check plantSite
        if (sim.bomb.plantSite) {
             site = sim.bomb.plantSite === sim.map.data.bombSites.A ? "A" : "B";
        }

        if (site) {
            stats.siteStats[site].attempts++;
            if (history.winner === TeamSide.T) {
                stats.siteStats[site].wins++;
            }
        }

        // Hero Plays
        for (const [pid, kills] of Object.entries(playerRoundKills)) {
            if (kills >= 4) {
                const p = roster.find(r => r.id === pid);
                stats.heroRounds.push({
                    roundId: globalRoundCounter + 1,
                    matchRound: sim.matchState.round,
                    playerId: pid,
                    playerName: p ? p.name : "Unknown",
                    kills,
                    weapon: "Multiple" // Simplified
                });
            }
        }
    }

    // Trade Kills Analysis
    // A trade is: Teammate of Victim kills Killer within 50 ticks (5s)
    const processedKills = new Set<number>(); // Index in roundKills

    // Sort kills by tick just in case
    roundKills.sort((a, b) => a.tick - b.tick);

    for (let i = 0; i < roundKills.length; i++) {
        const primaryKill = roundKills[i];
        // primaryKill: Killer(A) kills Victim(B)
        // We look for a subsequent kill where Killer(C) kills Killer(A)
        // And C is on Victim(B)'s side.

        // Find potential trade
        for (let j = i + 1; j < roundKills.length; j++) {
            const potentialTrade = roundKills[j];

            // Time window check
            if (potentialTrade.tick - primaryKill.tick > 50) break; // Too late

            // Check Logic
            // potentialTrade.victimId === primaryKill.killerId (The original killer dies)
            // potentialTrade.killerSide === primaryKill.victimSide (The avenger is on victim's team)

            if (potentialTrade.victimId === primaryKill.killerId &&
                potentialTrade.killerSide === primaryKill.victimSide) {

                // This is a trade!
                // But do we count the trade event or the original kill as "traded"?
                // "Percentage of kills that were immediately 'traded'" usually means "How often does a kill result in a trade?"
                // So we count the Primary Kill as "Traded".
                if (!processedKills.has(i)) {
                    stats.tradedKills++;
                    processedKills.add(i);
                }
                break; // Found the trade, move to next primary kill
            }
        }
    }

    globalRoundCounter++;
    stats.totalRounds++;

    if (globalRoundCounter % 100 === 0) {
        process.stdout.write(`\rProgress: ${globalRoundCounter}/${TARGET_ROUNDS} rounds.`);
    }
}

console.log("\nSimulation Complete.");

// Generate Report
const report = {
    totalRounds: stats.totalRounds,
    winRate: {
        T: (stats.tWins / stats.totalRounds * 100).toFixed(2) + "%",
        CT: (stats.ctWins / stats.totalRounds * 100).toFixed(2) + "%"
    },
    winTypes: stats.winTypes,
    siteSuccess: {
        A: {
            attempts: stats.siteStats.A.attempts,
            winRate: (stats.siteStats.A.wins / (stats.siteStats.A.attempts || 1) * 100).toFixed(2) + "%"
        },
        B: {
            attempts: stats.siteStats.B.attempts,
            winRate: (stats.siteStats.B.wins / (stats.siteStats.B.attempts || 1) * 100).toFixed(2) + "%"
        }
    },
    weaponPerformance: Object.entries(stats.weaponKills)
        .sort(([, a], [, b]) => b - a)
        .reduce((acc, [k, v]) => ({ ...acc, [k]: (v / stats.totalKills * 100).toFixed(2) + "%" }), {}),
    tradeRate: (stats.tradedKills / stats.totalKills * 100).toFixed(2) + "%",
    heroPlays: stats.heroRounds
};

fs.writeFileSync('simulation_audit.json', JSON.stringify(report, null, 2));
console.log("Audit saved to simulation_audit.json");
