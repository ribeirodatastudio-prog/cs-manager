import { Bot } from "./Bot";
import { GameMap } from "./GameMap";

export enum TeamSide {
  T = "T",
  CT = "CT",
}

export type Tactic =
  // T Side
  | "RUSH_A" | "RUSH_B"
  | "EXECUTE_A" | "EXECUTE_B"
  | "CONTACT_A" | "CONTACT_B"
  | "SPLIT_A" | "SPLIT_B"
  | "DEFAULT"
  // CT Side
  | "STANDARD"
  | "AGGRESSIVE_PUSH"
  | "GAMBLE_STACK_A" | "GAMBLE_STACK_B"
  | "RETAKE_SETUP";

interface TeamStrategy {
  tactic: Tactic;
  stage: "SETUP" | "EXECUTE"; // For Split/Execute timing
}

interface BotAssignment {
  targetZoneId: string;
  group?: string; // For splits
  role?: string; // "Anchor", "Rotator", "Lurker", "Support"
}

export class TacticsManager {
  private strategies: Record<TeamSide, TeamStrategy>;
  private assignments: Record<string, BotAssignment> = {}; // BotId -> Assignment

  constructor() {
    this.strategies = {
      T: { tactic: "DEFAULT", stage: "SETUP" },
      CT: { tactic: "STANDARD", stage: "SETUP" },
    };
  }

  setTactic(side: TeamSide, tactic: Tactic) {
    this.strategies[side].tactic = tactic;
    this.strategies[side].stage = "SETUP"; // Reset stage on change
    // Assignments must be re-evaluated externally or lazily
  }

  getTactic(side: TeamSide): Tactic {
    return this.strategies[side].tactic;
  }

  setStage(side: TeamSide, stage: "SETUP" | "EXECUTE") {
    this.strategies[side].stage = stage;
  }

  getStage(side: TeamSide): "SETUP" | "EXECUTE" {
    return this.strategies[side].stage;
  }

  public getRole(botId: string): string | undefined {
      return this.assignments[botId]?.role;
  }

  /**
   * Initializes or updates assignments for the round based on current tactics.
   * Should be called at round start or tactic change.
   */
  updateAssignments(bots: Bot[], map: GameMap) {
      const tBots = bots.filter(b => b.side === TeamSide.T && b.status === "ALIVE");
      const ctBots = bots.filter(b => b.side === TeamSide.CT && b.status === "ALIVE");

      this.assignTSide(tBots, map);
      this.assignCTSide(ctBots, map);
  }

  private assignTSide(bots: Bot[], map: GameMap) {
      const tactic = this.strategies.T.tactic;
      const sites = map.data.bombSites;

      // Reset assignments for these bots
      bots.forEach(b => {
          this.assignments[b.id] = { targetZoneId: "mid" }; // Default fallback
      });

      if (tactic === "DEFAULT") {
          // Spread: 2 A-side, 1 Mid, 2 B-side
          // Roles: Entry/IGL -> A/Long. Sniper -> Mid. Support/Lurker -> B.
          // Simple distribution by index
          const zones = ["long_doors", "top_mid", "outside_tunnels", "catwalk", "upper_tunnels"];
          bots.forEach((b, i) => {
              this.assignments[b.id] = { targetZoneId: zones[i % zones.length] };
          });
      }
      else if (tactic === "RUSH_A" || tactic === "EXECUTE_A" || tactic === "CONTACT_A") {
          bots.forEach(b => this.assignments[b.id] = { targetZoneId: sites.A });
      }
      else if (tactic === "RUSH_B" || tactic === "EXECUTE_B" || tactic === "CONTACT_B") {
          bots.forEach(b => this.assignments[b.id] = { targetZoneId: sites.B });
      }
      else if (tactic === "SPLIT_A") {
          // Group 1: Long (3), Group 2: Short (2)
          // MapData strategies logic
          const splitData = map.data.strategies?.split.A;
          if (splitData) {
              bots.forEach((b, i) => {
                  const groupIdx = i < 3 ? 0 : 1; // 3 go main, 2 go other
                  const group = splitData[groupIdx];
                  this.assignments[b.id] = {
                      targetZoneId: group.pincerPoint, // Initially go to pincer
                      group: group.name
                  };
                  b.splitGroup = group.name;
              });
          } else {
              // Fallback if no map data
              bots.forEach(b => this.assignments[b.id] = { targetZoneId: sites.A });
          }
      }
      else if (tactic === "SPLIT_B") {
           const splitData = map.data.strategies?.split.B;
           if (splitData) {
              bots.forEach((b, i) => {
                  const groupIdx = i < 3 ? 0 : 1;
                  const group = splitData[groupIdx];
                  this.assignments[b.id] = {
                      targetZoneId: group.pincerPoint,
                      group: group.name
                  };
                  b.splitGroup = group.name;
              });
           } else {
              bots.forEach(b => this.assignments[b.id] = { targetZoneId: sites.B });
           }
      }

      // Assign Support Role to T with highest Utility skill
      if (bots.length > 0) {
          const supportBot = bots.reduce((prev, curr) =>
              (curr.player.skills.technical.utility > prev.player.skills.technical.utility) ? curr : prev
          );
          if (this.assignments[supportBot.id]) {
              this.assignments[supportBot.id].role = "Support";
          }
      }
  }

  private assignCTSide(bots: Bot[], map: GameMap) {
      const tactic = this.strategies.CT.tactic;
      const sites = map.data.bombSites;

      if (bots.length === 0) return;

      // Define standard support zones
      const aSupport = ["a_ramp", "long_doors", "a_short"];
      const bSupport = ["b_window", "b_doors"];
      const midSupport = ["mid_doors", "ct_spawn"];

      if (tactic === "STANDARD" || tactic === "RETAKE_SETUP") {
          // Dynamic Allocation: 2-1-2 ratio
          // If 5 bots: 2 A, 1 Mid, 2 B
          // If 4 bots: 2 A, 2 B
          // If 3 bots: 1 A, 1 Mid, 1 B
          // If 2 bots: 1 A, 1 B
          // If 1 bot: A (or Mid?)

          let aCount = 0;
          let bCount = 0;
          let midCount = 0;

          if (bots.length >= 5) { aCount = 2; midCount = 0; bCount = 3; }
          else if (bots.length === 4) { aCount = 2; midCount = 0; bCount = 2; }
          else if (bots.length === 3) { aCount = 1; midCount = 1; bCount = 1; }
          else if (bots.length === 2) { aCount = 1; midCount = 0; bCount = 1; }
          else { aCount = 1; } // Last survivor usually anchors? Or rotates?

          // Sort bots by Positioning skill to assign Anchors
          const sortedBots = [...bots].sort((a, b) => b.player.skills.mental.positioning - a.player.skills.mental.positioning);

          const aGroup: Bot[] = [];
          const bGroup: Bot[] = [];
          const midGroup: Bot[] = [];

          sortedBots.forEach((bot, i) => {
              if (aGroup.length < aCount) aGroup.push(bot);
              else if (bGroup.length < bCount) bGroup.push(bot);
              else midGroup.push(bot);
          });

          // Assign A Group
          if (aGroup.length > 0) {
              // Best positioning -> Anchor (Site)
              this.assignments[aGroup[0].id] = { targetZoneId: sites.A, role: "Anchor" };
              // Others -> Support
              for (let i = 1; i < aGroup.length; i++) {
                  // Distribute to different support zones
                  const zone = aSupport[(i - 1) % aSupport.length];
                  this.assignments[aGroup[i].id] = { targetZoneId: zone, role: "Support" };
              }
          }

          // Assign B Group
          if (bGroup.length > 0) {
              this.assignments[bGroup[0].id] = { targetZoneId: sites.B, role: "Anchor" };
              for (let i = 1; i < bGroup.length; i++) {
                  const zone = bSupport[(i - 1) % bSupport.length];
                  this.assignments[bGroup[i].id] = { targetZoneId: zone, role: "Support" };
              }
          }

          // Assign Mid Group
          midGroup.forEach((bot, i) => {
              const zone = midSupport[i % midSupport.length];
              this.assignments[bot.id] = { targetZoneId: zone, role: "Support" };
          });

      }
      else if (tactic === "AGGRESSIVE_PUSH") {
          const pushes = ["long_doors", "lower_tunnels", "top_mid", "catwalk", "outside_long"];
          bots.forEach((b, i) => {
              this.assignments[b.id] = { targetZoneId: pushes[i % pushes.length] };
          });
      }
      else if (tactic === "GAMBLE_STACK_A") {
           // 4 A, 1 B (if full)
           const bCount = bots.length > 1 ? 1 : 0;
           const aCount = bots.length - bCount;

           const sortedBots = [...bots].sort((a, b) => b.player.skills.mental.positioning - a.player.skills.mental.positioning);

           // Anchor for B is critical if solo? Or sacrifice?
           // Usually Gamble Stack puts 'weaker' player solo or 'star' player solo?
           // Let's put best anchor on stack? Or best anchor solo?
           // Put best anchor on the SOLO site to survive.

           const soloBot = sortedBots[0];
           const stackBots = sortedBots.slice(1);

           if (bCount > 0) {
               this.assignments[soloBot.id] = { targetZoneId: sites.B, role: "Anchor" };
           } else {
               // All A
               stackBots.push(soloBot); // Just move back
           }

           // Stack A
           if (stackBots.length > 0) {
               // 1 Anchor, rest Support/Aggressive
               this.assignments[stackBots[0].id] = { targetZoneId: sites.A, role: "Anchor" };
               for (let i = 1; i < stackBots.length; i++) {
                   const zone = aSupport[(i - 1) % aSupport.length];
                   this.assignments[stackBots[i].id] = { targetZoneId: zone, role: "Support" };
               }
           }
      }
      else if (tactic === "GAMBLE_STACK_B") {
           const aCount = bots.length > 1 ? 1 : 0;
           const sortedBots = [...bots].sort((a, b) => b.player.skills.mental.positioning - a.player.skills.mental.positioning);

           const soloBot = sortedBots[0];
           const stackBots = sortedBots.slice(1);

           if (aCount > 0) {
               this.assignments[soloBot.id] = { targetZoneId: sites.A, role: "Anchor" };
           } else {
               stackBots.push(soloBot);
           }

           if (stackBots.length > 0) {
               this.assignments[stackBots[0].id] = { targetZoneId: sites.B, role: "Anchor" };
               for (let i = 1; i < stackBots.length; i++) {
                   const zone = bSupport[(i - 1) % bSupport.length];
                   this.assignments[stackBots[i].id] = { targetZoneId: zone, role: "Support" };
               }
           }
      }
  }

  /**
   * Returns the target zone ID for a given bot based on strategy state.
   */
  getGoalZone(bot: Bot, map: GameMap): string {
    const side = bot.side;
    const strategy = this.strategies[side];
    const assignment = this.assignments[bot.id];

    // If no assignment, try to re-assign or fallback
    if (!assignment) {
        // Fallback
        if (side === "T") return "mid";
        return "ct_spawn";
    }

    // Dynamic Handling based on Phase
    if (side === "T") {
        if (strategy.tactic.includes("SPLIT")) {
            if (strategy.stage === "SETUP") {
                return assignment.targetZoneId; // Pincer point
            } else {
                // EXECUTE -> Go to Site
                if (strategy.tactic.includes("_A")) return map.data.bombSites.A;
                return map.data.bombSites.B;
            }
        }
    }

    return assignment.targetZoneId;
  }
}
