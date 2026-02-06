/**
 * CS2 Movement Constants - Accurate to real CS2 values
 * All speeds are in units per second
 * Tick rate: 20 ticks/second (0.05s per tick)
 */
export const TICK_RATE = 20;
export const TICK_DURATION = 1 / TICK_RATE; // 0.05 seconds

/**
 * CS2 Movement Speeds (units/second)
 * Source: CS2 game files and community testing
 */
export const CS2_MOVEMENT_SPEEDS = {
  // Base movement speeds (knife speed = 250 u/s baseline)
  KNIFE: 250,
  // Pistols
  GLOCK: 240,
  USP_S: 240,
  P2000: 240,
  P250: 240,
  FIVE_SEVEN: 240,
  TEC9: 240,
  CZ75: 240,
  DUAL_BERETTAS: 240,
  DESERT_EAGLE: 230,
  R8_REVOLVER: 220,

  // SMGs
  MP9: 240,
  MAC10: 240,
  MP7: 220,
  MP5SD: 235,
  UMP45: 230,
  P90: 230,
  BIZON: 240,

  // Shotguns
  NOVA: 220,
  XM1014: 215,
  MAG7: 225,
  SAWED_OFF: 210,

  // Rifles
  GALIL: 215,
  FAMAS: 220,
  AK47: 215,
  M4A4: 225,
  M4A1S: 225,
  SG553: 210,
  AUG: 220,

  // Snipers
  SSG08: 230,
  AWP: 200,
  G3SG1: 210,
  SCAR20: 215,

  // Heavy
  M249: 195,
  NEGEV: 150, // Very slow when deployed

  // Modifiers
  WALK_SPEED_MULTIPLIER: 0.52, // Shift-walking
  CROUCH_SPEED_MULTIPLIER: 0.34, // Crouching
  LADDER_SPEED: 130,

  // Acceleration
  ACCELERATION: 5.6, // How quickly players reach max speed
  FRICTION: 5.2, // Ground friction
  STOP_SPEED: 100, // Speed at which friction starts applying
};

/**
 * Map coordinates transformation
 * CS2 nav mesh uses different coordinate system than our visual map
 */
export const DUST2_COORDINATES = {
  // Map bounds from nav mesh data
  NAV_MIN_X: -2200,
  NAV_MAX_X: 1700,
  NAV_MIN_Y: -3700,
  NAV_MAX_Y: 900,
  // Visual map dimensions (pixels)
  VISUAL_WIDTH: 1024,
  VISUAL_HEIGHT: 1024,

  // Conversion functions
  navToVisual: (navX: number, navY: number): { x: number; y: number } => {
    const navWidth = 1700 - (-2200); // 3900
    const navHeight = 900 - (-3700); // 4600

    const normalizedX = (navX - (-2200)) / navWidth;
    const normalizedY = (navY - (-3700)) / navHeight;

    return {
      x: normalizedX * 1024,
      y: normalizedY * 1024
    };
  },

  visualToNav: (visualX: number, visualY: number): { x: number; y: number } => {
    const navWidth = 1700 - (-2200);
    const navHeight = 900 - (-3700);

    const normalizedX = visualX / 1024;
    const normalizedY = visualY / 1024;

    return {
      x: normalizedX * navWidth + (-2200),
      y: normalizedY * navHeight + (-3700)
    };
  }
};

/**
 * Dust 2 Spawn and Site Positions (in NAV coordinates)
 * These are extracted from the official CS2 nav mesh
 */
export const DUST2_LOCATIONS = {
  SPAWNS: {
    T: [
      { x: 486, y: 948, navId: "1" },
      { x: 470, y: 960, navId: "1" },
      { x: 502, y: 935, navId: "1" },
      { x: 520, y: 950, navId: "1" },
      { x: 455, y: 970, navId: "1" }
    ],
    CT: [
      { x: 575, y: 167, navId: "673" },
      { x: 560, y: 180, navId: "673" },
      { x: 590, y: 155, navId: "673" },
      { x: 545, y: 190, navId: "673" },
      { x: 605, y: 170, navId: "673" }
    ]
  },
  BOMB_SITES: {
    // A Site center and plant zones
    A: {
      center: { x: 795, y: 206 },
      plantZones: [
        { x: 815, y: 181, name: "A Default" },
        { x: 780, y: 220, name: "A Triple" },
        { x: 850, y: 190, name: "A Long" },
        { x: 770, y: 180, name: "A Ramp" }
      ],
      navIds: ["a_site", "a_default", "a_boxes"]
    },

    // B Site center and plant zones
    B: {
      center: { x: 134, y: 208 },
      plantZones: [
        { x: 166, y: 176, name: "B Default" },
        { x: 140, y: 185, name: "B Back" },
        { x: 155, y: 200, name: "B Tunnel Side" },
        { x: 145, y: 220, name: "B Window Side" }
      ],
      navIds: ["b_site", "b_default", "b_back_plat"]
    }
  },

  /**
   * Strategic positions for tactical gameplay
   */
  STRATEGIC_POSITIONS: {
    // Long A positions
    LONG_CORNER: { x: 889, y: 664, cover: 0.8 },
    LONG_PIT: { x: 940, y: 620, cover: 0.9 },
    LONG_DOORS: { x: 889, y: 664, cover: 0.7 },
    // Short/Catwalk
    CAT_UPPER: { x: 650, y: 360, cover: 0.5 },
    CAT_LOWER: { x: 608, y: 418, cover: 0.4 },
    XBOX: { x: 515, y: 590, cover: 0.8 },

    // Mid
    TOP_MID: { x: 484, y: 827, cover: 0.3 },
    SUICIDE: { x: 484, y: 492, cover: 0.1 },
    LOWER_MID: { x: 500, y: 420, cover: 0.3 },

    // B
    UPPER_TUNNELS: { x: 133, y: 705, cover: 0.8 },
    B_TUNNELS: { x: 136, y: 416, cover: 0.7 },
    B_CLOSET: { x: 175, y: 229, cover: 0.9 }
  }
};

/**
 * Weapon mobility mapping - matches CS2_MOVEMENT_SPEEDS
 */
export const WEAPON_MOBILITY_MAP: Record<string, number> = {
  "knife": CS2_MOVEMENT_SPEEDS.KNIFE,
  // Pistols
  "glock-18": CS2_MOVEMENT_SPEEDS.GLOCK,
  "usp-s": CS2_MOVEMENT_SPEEDS.USP_S,
  "p2000": CS2_MOVEMENT_SPEEDS.P2000,
  "p250": CS2_MOVEMENT_SPEEDS.P250,
  "five-seven": CS2_MOVEMENT_SPEEDS.FIVE_SEVEN,
  "tec-9": CS2_MOVEMENT_SPEEDS.TEC9,
  "cz75-auto": CS2_MOVEMENT_SPEEDS.CZ75,
  "dual_berettas": CS2_MOVEMENT_SPEEDS.DUAL_BERETTAS,
  "desert_eagle": CS2_MOVEMENT_SPEEDS.DESERT_EAGLE,
  "r8_revolver": CS2_MOVEMENT_SPEEDS.R8_REVOLVER,

  // SMGs
  "mp9": CS2_MOVEMENT_SPEEDS.MP9,
  "mac-10": CS2_MOVEMENT_SPEEDS.MAC10,
  "mp7": CS2_MOVEMENT_SPEEDS.MP7,
  "mp5-sd": CS2_MOVEMENT_SPEEDS.MP5SD,
  "ump-45": CS2_MOVEMENT_SPEEDS.UMP45,
  "p90": CS2_MOVEMENT_SPEEDS.P90,
  "pp-bizon": CS2_MOVEMENT_SPEEDS.BIZON,

  // Shotguns
  "nova": CS2_MOVEMENT_SPEEDS.NOVA,
  "xm1014": CS2_MOVEMENT_SPEEDS.XM1014,
  "mag-7": CS2_MOVEMENT_SPEEDS.MAG7,
  "sawed-off": CS2_MOVEMENT_SPEEDS.SAWED_OFF,

  // Rifles
  "galil_ar": CS2_MOVEMENT_SPEEDS.GALIL,
  "famas": CS2_MOVEMENT_SPEEDS.FAMAS,
  "ak-47": CS2_MOVEMENT_SPEEDS.AK47,
  "m4a4": CS2_MOVEMENT_SPEEDS.M4A4,
  "m4a1-s": CS2_MOVEMENT_SPEEDS.M4A1S,
  "sg_553": CS2_MOVEMENT_SPEEDS.SG553,
  "aug": CS2_MOVEMENT_SPEEDS.AUG,

  // Snipers
  "ssg_08": CS2_MOVEMENT_SPEEDS.SSG08,
  "awp": CS2_MOVEMENT_SPEEDS.AWP,
  "g3sg1": CS2_MOVEMENT_SPEEDS.G3SG1,
  "scar-20": CS2_MOVEMENT_SPEEDS.SCAR20,

  // Heavy
  "m249": CS2_MOVEMENT_SPEEDS.M249,
  "negev": CS2_MOVEMENT_SPEEDS.NEGEV
};

/**
 * Tactical movement behaviors for CS2
 */
export const TACTICAL_BEHAVIORS = {
  // Angle clearing speeds
  ANGLE_CLEAR_SPEED: 0.7, // Multiplier when clearing angles
  JIGGLE_PEEK_SPEED: 1.0, // Pre-fire positions
  SHOULD_PREFIRE_RANGE: 500, // Units

  // Utility usage distances
  FLASH_THROW_RANGE: 600,
  SMOKE_THROW_RANGE: 700,
  HE_THROW_RANGE: 650,
  MOLOTOV_THROW_RANGE: 650,

  // Timing (in ticks at 20 tick rate)
  ANGLE_HOLD_DURATION: 40, // 2 seconds
  CLEAR_ANGLE_PAUSE: 10, // 0.5 seconds
  UTILITY_THROW_TIME: 6, // 0.3 seconds
  PLANT_TIME: 60, // 3 seconds
  DEFUSE_TIME: 200, // 10 seconds (without kit)
  DEFUSE_TIME_KIT: 100, // 5 seconds (with kit)
};
