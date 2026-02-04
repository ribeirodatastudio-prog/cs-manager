export enum WeaponType {
  PISTOL = "Pistol",
  SMG = "SMG",
  SHOTGUN = "Shotgun",
  RIFLE = "Rifle",
  SNIPER = "Sniper",
  MACHINE_GUN = "Machine Gun",
  KNIFE = "Knife"
}

export enum TeamSide {
  T = "T",
  CT = "CT"
}

export interface Weapon {
  name: string;
  cost: number;
  killReward: number;
  type: WeaponType;
  team?: TeamSide; // If undefined, available to both
}

export const WEAPONS: Record<string, Weapon> = {
  // Pistols
  "glock-18": { name: "Glock-18", cost: 200, killReward: 300, type: WeaponType.PISTOL, team: TeamSide.T },
  "usp-s": { name: "USP-S", cost: 200, killReward: 300, type: WeaponType.PISTOL, team: TeamSide.CT },
  "p2000": { name: "P2000", cost: 200, killReward: 300, type: WeaponType.PISTOL, team: TeamSide.CT },
  "dual_berettas": { name: "Dual Berettas", cost: 300, killReward: 300, type: WeaponType.PISTOL },
  "p250": { name: "P250", cost: 300, killReward: 300, type: WeaponType.PISTOL },
  "tec-9": { name: "Tec-9", cost: 500, killReward: 300, type: WeaponType.PISTOL, team: TeamSide.T },
  "five-seven": { name: "Five-SeveN", cost: 500, killReward: 300, type: WeaponType.PISTOL, team: TeamSide.CT },
  "cz75-auto": { name: "CZ75-Auto", cost: 500, killReward: 300, type: WeaponType.PISTOL },
  "desert_eagle": { name: "Desert Eagle", cost: 700, killReward: 300, type: WeaponType.PISTOL },
  "r8_revolver": { name: "R8 Revolver", cost: 600, killReward: 300, type: WeaponType.PISTOL },

  // Mid-Tier (SMGs & Heavy)
  "mac-10": { name: "MAC-10", cost: 1050, killReward: 600, type: WeaponType.SMG, team: TeamSide.T },
  "mp9": { name: "MP9", cost: 1250, killReward: 600, type: WeaponType.SMG, team: TeamSide.CT },
  "mp7": { name: "MP7", cost: 1500, killReward: 600, type: WeaponType.SMG },
  "mp5-sd": { name: "MP5-SD", cost: 1400, killReward: 600, type: WeaponType.SMG },
  "ump-45": { name: "UMP-45", cost: 1200, killReward: 600, type: WeaponType.SMG },
  "p90": { name: "P90", cost: 2350, killReward: 300, type: WeaponType.SMG }, // P90 is standard reward
  "pp-bizon": { name: "PP-Bizon", cost: 1300, killReward: 600, type: WeaponType.SMG },

  "nova": { name: "Nova", cost: 1050, killReward: 900, type: WeaponType.SHOTGUN },
  "sawed-off": { name: "Sawed-Off", cost: 1100, killReward: 900, type: WeaponType.SHOTGUN, team: TeamSide.T },
  "mag-7": { name: "MAG-7", cost: 1300, killReward: 900, type: WeaponType.SHOTGUN, team: TeamSide.CT },
  "xm1014": { name: "XM1014", cost: 2000, killReward: 900, type: WeaponType.SHOTGUN },

  "m249": { name: "M249", cost: 5200, killReward: 300, type: WeaponType.MACHINE_GUN },
  "negev": { name: "Negev", cost: 1700, killReward: 300, type: WeaponType.MACHINE_GUN },

  // Rifles
  "galil_ar": { name: "Galil AR", cost: 1800, killReward: 300, type: WeaponType.RIFLE, team: TeamSide.T },
  "famas": { name: "FAMAS", cost: 1950, killReward: 300, type: WeaponType.RIFLE, team: TeamSide.CT },
  "ak-47": { name: "AK-47", cost: 2700, killReward: 300, type: WeaponType.RIFLE, team: TeamSide.T },
  "m4a4": { name: "M4A4", cost: 2900, killReward: 300, type: WeaponType.RIFLE, team: TeamSide.CT },
  "m4a1-s": { name: "M4A1-S", cost: 2900, killReward: 300, type: WeaponType.RIFLE, team: TeamSide.CT },
  "sg_553": { name: "SG 553", cost: 3000, killReward: 300, type: WeaponType.RIFLE, team: TeamSide.T },
  "aug": { name: "AUG", cost: 3300, killReward: 300, type: WeaponType.RIFLE, team: TeamSide.CT },
  "ssg_08": { name: "SSG 08", cost: 1700, killReward: 300, type: WeaponType.SNIPER },
  "awp": { name: "AWP", cost: 4750, killReward: 100, type: WeaponType.SNIPER },
  "g3sg1": { name: "G3SG1", cost: 5000, killReward: 300, type: WeaponType.SNIPER, team: TeamSide.T },
  "scar-20": { name: "SCAR-20", cost: 5000, killReward: 300, type: WeaponType.SNIPER, team: TeamSide.CT },

  "knife": { name: "Knife", cost: 0, killReward: 1500, type: WeaponType.KNIFE }
};

export const EQUIPMENT_COSTS = {
  KEVLAR: 650,
  HELMET: 350, // Upgrade cost (1000 total)
  FULL_ARMOR: 1000,
  KIT: 400,
  ZEUS: 200,
  FLASHBANG: 200,
  SMOKE: 300,
  HE: 300,
  MOLOTOV: 400,
  INCENDIARY: 500,
  DECOY: 50
};

export const ECONOMY = {
  START_MONEY: 800,
  MAX_MONEY: 16000,
  OT_START_MONEY: 10000, // MR3 OT usually 10k or 16k? User said 16000.
  // "Overtime: If 12-12, start MR3 with $16,000 starting cash." - I will use 16000.
  OT_MR12_MONEY: 16000,

  LOSS_BONUS_START: 1400,
  LOSS_BONUS_INCREMENT: 500,
  LOSS_BONUS_MAX: 3400,
  LOSS_BONUS_PISTOL_ROUND: 1900, // Specific rule

  WIN_REWARD_ELIMINATION: 3250,
  WIN_REWARD_TIME_OUT_CT: 3250,
  WIN_REWARD_BOMB_DEFUSED: 3500,
  WIN_REWARD_BOMB_EXPLODED: 3500,

  PLANT_BONUS_TEAM: 800, // For Ts if they lose but planted
  PLANT_BONUS_PLAYER: 300, // For the planter
  DEFUSE_BONUS_PLAYER: 300 // For the defuser
};
