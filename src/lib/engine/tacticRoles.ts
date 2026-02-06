import { Tactic } from "./TacticsManager";

export interface TacticRoleDef {
  name: string;
  description: string;
  behavior: "Entry Fragger" | "Support" | "Lurker" | "Anchor" | "Rotator" | "IGL" | "Sniper" | "Rifler"; // Maps to Bot.roundRole
}

export const TACTIC_ROLES: Record<Tactic, TacticRoleDef[]> = {
  // --- CT TACTICS ---
  "STANDARD": [
    { name: "Anchor A", description: "Static defense, holds primary site lines, last to rotate.", behavior: "Anchor" },
    { name: "Support A / Rotator", description: "Mobile defense, supports A, ready to rotate Mid or B.", behavior: "Support" },
    { name: "Mid Player", description: "Controls middle map, provides early info, pivots to either site.", behavior: "Rotator" },
    { name: "Support B / Rotator", description: "Mobile defense, supports B, ready to rotate Mid or A.", behavior: "Support" },
    { name: "Anchor B", description: "Static defense, holds primary site lines, last to rotate.", behavior: "Anchor" }
  ],
  "AGGRESSIVE_PUSH": [
    { name: "Entry Aggressor 1", description: "Pushes first to take space/fight.", behavior: "Entry Fragger" },
    { name: "Trade Aggressor 2", description: "Follows immediate contact to trade kills.", behavior: "Entry Fragger" },
    { name: "Support (Flasher)", description: "Throws pop-flashes/mollies to enable pushers.", behavior: "Support" },
    { name: "Passive Anchor 1", description: "Holds the other site solo, playing safe.", behavior: "Anchor" },
    { name: "Passive Rotator", description: "Holds Mid/Connector passively to prevent backstabs.", behavior: "Rotator" }
  ],
  "GAMBLE_STACK_A": [
    { name: "Solo Anchor B", description: "The 'Sacrifice'. Plays purely for info on B.", behavior: "Anchor" },
    { name: "AWP / Long Angle", description: "Holds the longest sightline on A.", behavior: "Sniper" },
    { name: "Close Angle Anchor", description: "Plays aggressive/hiding spot on A.", behavior: "Anchor" },
    { name: "Crossfire Player", description: "Sets up bait-and-switch angle with Anchor.", behavior: "Support" },
    { name: "Utility Spammer", description: "Delays push with nades.", behavior: "Support" }
  ],
  "GAMBLE_STACK_B": [
    { name: "Solo Anchor A", description: "The 'Sacrifice'. Plays purely for info on A.", behavior: "Anchor" },
    { name: "AWP / Long Angle", description: "Holds the longest sightline on B.", behavior: "Sniper" },
    { name: "Close Angle Anchor", description: "Plays aggressive/hiding spot on B.", behavior: "Anchor" },
    { name: "Crossfire Player", description: "Sets up bait-and-switch angle with Anchor.", behavior: "Support" },
    { name: "Utility Spammer", description: "Delays push with nades.", behavior: "Support" }
  ],
  "RETAKE_SETUP": [
    { name: "Retake Entry 1", description: "First to swing, creates space.", behavior: "Entry Fragger" },
    { name: "Retake Entry 2 (Trade)", description: "Swings immediately after Entry 1.", behavior: "Entry Fragger" },
    { name: "Utility Support", description: "Throws retake flashes and smokes.", behavior: "Support" },
    { name: "Flank Watcher", description: "Clears/Holds back lines.", behavior: "Lurker" },
    { name: "Defuser", description: "Carries kit, sticks defuse.", behavior: "Support" }
  ],

  // --- T TACTICS ---
  "DEFAULT": [
    { name: "Entry (Map Control)", description: "Pushes for early map control.", behavior: "Entry Fragger" },
    { name: "Support", description: "Smokes/flashes for the Entry.", behavior: "Support" },
    { name: "Mid Controller", description: "Holds/Fights mid to stop CT rotations.", behavior: "Support" },
    { name: "Lurker", description: "Holds opposite extremity (passive).", behavior: "Lurker" },
    { name: "IGL/Pack Leader", description: "Floats between groups.", behavior: "IGL" }
  ],
  "RUSH_A": [
    { name: "Entry Fragger 1", description: "First in, creates chaos.", behavior: "Entry Fragger" },
    { name: "Entry Fragger 2", description: "Second in, trades Entry 1.", behavior: "Entry Fragger" },
    { name: "Entry Fragger 3", description: "Third in, clears back-site.", behavior: "Entry Fragger" },
    { name: "Support (Run & Gun)", description: "Throws flashes moving, watches flank.", behavior: "Support" },
    { name: "Bomb Carrier", description: "Follows pack, plants immediately.", behavior: "Support" }
  ],
  "RUSH_B": [
    { name: "Entry Fragger 1", description: "First in, creates chaos.", behavior: "Entry Fragger" },
    { name: "Entry Fragger 2", description: "Second in, trades Entry 1.", behavior: "Entry Fragger" },
    { name: "Entry Fragger 3", description: "Third in, clears back-site.", behavior: "Entry Fragger" },
    { name: "Support (Run & Gun)", description: "Throws flashes moving, watches flank.", behavior: "Support" },
    { name: "Bomb Carrier", description: "Follows pack, plants immediately.", behavior: "Support" }
  ],
  "EXECUTE_A": [
    { name: "Entry Fragger", description: "Initiates site take after utility.", behavior: "Entry Fragger" },
    { name: "Trade Fragger", description: "Follows closely to trade.", behavior: "Entry Fragger" },
    { name: "Main Support", description: "Lineups player (Smokes/Mollies).", behavior: "Support" },
    { name: "Flash Support", description: "Throws pop-flashes for entry duo.", behavior: "Support" },
    { name: "Lurker/Cut-off", description: "Holds rotation points.", behavior: "Lurker" }
  ],
  "EXECUTE_B": [
    { name: "Entry Fragger", description: "Initiates site take after utility.", behavior: "Entry Fragger" },
    { name: "Trade Fragger", description: "Follows closely to trade.", behavior: "Entry Fragger" },
    { name: "Main Support", description: "Lineups player (Smokes/Mollies).", behavior: "Support" },
    { name: "Flash Support", description: "Throws pop-flashes for entry duo.", behavior: "Support" },
    { name: "Lurker/Cut-off", description: "Holds rotation points.", behavior: "Lurker" }
  ],
  "SPLIT_A": [
    { name: "Main Group Entry", description: "Attacks from main chokepoint.", behavior: "Entry Fragger" },
    { name: "Main Group Support", description: "Supporting the main group entry.", behavior: "Support" },
    { name: "Mid/Split Entry", description: "Attacks from secondary path.", behavior: "Entry Fragger" },
    { name: "Mid/Split Trade", description: "Trades the Mid Entry, pinches site.", behavior: "Entry Fragger" },
    { name: "Lurker", description: "Holds rear/flank.", behavior: "Lurker" }
  ],
  "SPLIT_B": [
    { name: "Main Group Entry", description: "Attacks from main chokepoint.", behavior: "Entry Fragger" },
    { name: "Main Group Support", description: "Supporting the main group entry.", behavior: "Support" },
    { name: "Mid/Split Entry", description: "Attacks from secondary path.", behavior: "Entry Fragger" },
    { name: "Mid/Split Trade", description: "Trades the Mid Entry, pinches site.", behavior: "Entry Fragger" },
    { name: "Lurker", description: "Holds rear/flank.", behavior: "Lurker" }
  ],
  "CONTACT_A": [
    { name: "Pointman (Silent)", description: "Shoulders peek, walks, no nades.", behavior: "Entry Fragger" },
    { name: "Shadow (Trade)", description: "Walks directly behind Pointman.", behavior: "Entry Fragger" },
    { name: "Bomb Carrier", description: "Tucked safely in middle of pack.", behavior: "Support" },
    { name: "Rear Guard", description: "Watches behind group.", behavior: "Support" },
    { name: "Lurker", description: "Opposite side to sell fake.", behavior: "Lurker" }
  ],
  "CONTACT_B": [
    { name: "Pointman (Silent)", description: "Shoulders peek, walks, no nades.", behavior: "Entry Fragger" },
    { name: "Shadow (Trade)", description: "Walks directly behind Pointman.", behavior: "Entry Fragger" },
    { name: "Bomb Carrier", description: "Tucked safely in middle of pack.", behavior: "Support" },
    { name: "Rear Guard", description: "Watches behind group.", behavior: "Support" },
    { name: "Lurker", description: "Opposite side to sell fake.", behavior: "Lurker" }
  ]
};
