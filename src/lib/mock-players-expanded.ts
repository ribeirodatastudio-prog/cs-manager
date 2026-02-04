import { Player } from "@/types";

/**
 * Expanded Mock data containing 25 diverse player profiles.
 */
export const MOCK_PLAYERS_EXPANDED: Player[] = [
  // --- Original Top Tier (1-5) ---
  {
    id: "p1",
    name: "Mathieu 'ZywOo' Herbaut",
    age: 23,
    nationality: "France",
    role: "Star AWPer",
    skills: {
      technical: { shooting: 199, crosshairPlacement: 196, sprayControl: 192, utilityUsage: 170, firstBulletPrecision: 195, movement: 188, clutching: 198 },
      mental: { positioning: 190, adaptability: 195, composure: 198, communication: 160, aggression: 150 },
      physical: { reactionTime: 197, dexterity: 190, consistency: 199, injuryResistance: 180 },
    },
  },
  {
    id: "p2",
    name: "Finn 'karrigan' Andersen",
    age: 33,
    nationality: "Denmark",
    role: "IGL",
    skills: {
      technical: { shooting: 150, crosshairPlacement: 155, sprayControl: 145, utilityUsage: 195, firstBulletPrecision: 140, movement: 160, clutching: 165 },
      mental: { positioning: 185, adaptability: 199, composure: 180, communication: 200, aggression: 160 },
      physical: { reactionTime: 140, dexterity: 150, consistency: 160, injuryResistance: 150 },
    },
  },
  {
    id: "p3",
    name: "Nikola 'NiKo' Kovač",
    age: 27,
    nationality: "Bosnia",
    role: "Entry Fragger",
    skills: {
      technical: { shooting: 198, crosshairPlacement: 200, sprayControl: 195, utilityUsage: 165, firstBulletPrecision: 199, movement: 180, clutching: 185 },
      mental: { positioning: 170, adaptability: 175, composure: 160, communication: 170, aggression: 195 },
      physical: { reactionTime: 190, dexterity: 192, consistency: 185, injuryResistance: 175 },
    },
  },
  {
    id: "p4",
    name: "Ilya 'Perfecto' Zalutskiy",
    age: 24,
    nationality: "Russia",
    role: "Support",
    skills: {
      technical: { shooting: 175, crosshairPlacement: 170, sprayControl: 175, utilityUsage: 198, firstBulletPrecision: 165, movement: 170, clutching: 195 },
      mental: { positioning: 190, adaptability: 185, composure: 195, communication: 190, aggression: 130 },
      physical: { reactionTime: 170, dexterity: 175, consistency: 190, injuryResistance: 185 },
    },
  },
  {
    id: "p5",
    name: "Robin 'ropz' Kool",
    age: 24,
    nationality: "Estonia",
    role: "Lurker",
    skills: {
      technical: { shooting: 190, crosshairPlacement: 195, sprayControl: 188, utilityUsage: 175, firstBulletPrecision: 192, movement: 185, clutching: 190 },
      mental: { positioning: 198, adaptability: 180, composure: 190, communication: 175, aggression: 140 },
      physical: { reactionTime: 185, dexterity: 188, consistency: 192, injuryResistance: 180 },
    },
  },

  // --- High Tier Challengers (6-10) ---
  {
    id: "p6",
    name: "Oleksandr 's1mple' Kostyliev",
    age: 26,
    nationality: "Ukraine",
    role: "Star AWPer",
    skills: {
      technical: { shooting: 200, crosshairPlacement: 198, sprayControl: 195, utilityUsage: 175, firstBulletPrecision: 198, movement: 195, clutching: 199 },
      mental: { positioning: 185, adaptability: 190, composure: 180, communication: 165, aggression: 180 },
      physical: { reactionTime: 199, dexterity: 195, consistency: 190, injuryResistance: 170 },
    },
  },
  {
    id: "p7",
    name: "Dan 'apEX' Madesclaire",
    age: 31,
    nationality: "France",
    role: "IGL",
    skills: {
      technical: { shooting: 160, crosshairPlacement: 165, sprayControl: 160, utilityUsage: 185, firstBulletPrecision: 155, movement: 175, clutching: 160 },
      mental: { positioning: 175, adaptability: 185, composure: 150, communication: 195, aggression: 190 },
      physical: { reactionTime: 160, dexterity: 165, consistency: 155, injuryResistance: 160 },
    },
  },
  {
    id: "p8",
    name: "Russel 'Twistzz' Van Dulken",
    age: 24,
    nationality: "Canada",
    role: "Rifler",
    skills: {
      technical: { shooting: 195, crosshairPlacement: 199, sprayControl: 190, utilityUsage: 180, firstBulletPrecision: 199, movement: 180, clutching: 185 },
      mental: { positioning: 180, adaptability: 185, composure: 185, communication: 180, aggression: 145 },
      physical: { reactionTime: 185, dexterity: 185, consistency: 190, injuryResistance: 185 },
    },
  },
  {
    id: "p9",
    name: "Helvijs 'broky' Saukants",
    age: 23,
    nationality: "Latvia",
    role: "AWPer",
    skills: {
      technical: { shooting: 185, crosshairPlacement: 180, sprayControl: 170, utilityUsage: 160, firstBulletPrecision: 185, movement: 170, clutching: 195 },
      mental: { positioning: 190, adaptability: 175, composure: 195, communication: 160, aggression: 120 },
      physical: { reactionTime: 180, dexterity: 175, consistency: 185, injuryResistance: 180 },
    },
  },
  {
    id: "p10",
    name: "Lotan 'Spinx' Giladi",
    age: 23,
    nationality: "Israel",
    role: "Lurker",
    skills: {
      technical: { shooting: 188, crosshairPlacement: 185, sprayControl: 190, utilityUsage: 170, firstBulletPrecision: 180, movement: 180, clutching: 185 },
      mental: { positioning: 192, adaptability: 180, composure: 185, communication: 170, aggression: 150 },
      physical: { reactionTime: 182, dexterity: 180, consistency: 188, injuryResistance: 175 },
    },
  },

  // --- Mid Tier / Specialists (11-15) ---
  {
    id: "p11",
    name: "Casper 'cadiaN' Møller",
    age: 28,
    nationality: "Denmark",
    role: "IGL/AWP",
    skills: {
      technical: { shooting: 170, crosshairPlacement: 165, sprayControl: 160, utilityUsage: 180, firstBulletPrecision: 175, movement: 165, clutching: 195 },
      mental: { positioning: 175, adaptability: 185, composure: 190, communication: 195, aggression: 170 },
      physical: { reactionTime: 170, dexterity: 165, consistency: 160, injuryResistance: 165 },
    },
  },
  {
    id: "p12",
    name: "Håvard 'rain' Nygaard",
    age: 29,
    nationality: "Norway",
    role: "Entry Fragger",
    skills: {
      technical: { shooting: 180, crosshairPlacement: 175, sprayControl: 185, utilityUsage: 170, firstBulletPrecision: 175, movement: 175, clutching: 170 },
      mental: { positioning: 170, adaptability: 175, composure: 185, communication: 175, aggression: 185 },
      physical: { reactionTime: 175, dexterity: 180, consistency: 180, injuryResistance: 190 },
    },
  },
  {
    id: "p13",
    name: "David 'frozen' Čerňanský",
    age: 21,
    nationality: "Slovakia",
    role: "Rifler",
    skills: {
      technical: { shooting: 185, crosshairPlacement: 185, sprayControl: 182, utilityUsage: 175, firstBulletPrecision: 180, movement: 180, clutching: 188 },
      mental: { positioning: 185, adaptability: 180, composure: 188, communication: 175, aggression: 145 },
      physical: { reactionTime: 180, dexterity: 180, consistency: 190, injuryResistance: 180 },
    },
  },
  {
    id: "p14",
    name: "Keith 'NAF' Markovic",
    age: 26,
    nationality: "Canada",
    role: "Support",
    skills: {
      technical: { shooting: 178, crosshairPlacement: 175, sprayControl: 180, utilityUsage: 185, firstBulletPrecision: 170, movement: 172, clutching: 192 },
      mental: { positioning: 188, adaptability: 182, composure: 198, communication: 175, aggression: 135 },
      physical: { reactionTime: 172, dexterity: 175, consistency: 192, injuryResistance: 175 },
    },
  },
  {
    id: "p15",
    name: "Jonathan 'EliGE' Jablonowski",
    age: 26,
    nationality: "USA",
    role: "Rifler",
    skills: {
      technical: { shooting: 188, crosshairPlacement: 185, sprayControl: 195, utilityUsage: 170, firstBulletPrecision: 182, movement: 185, clutching: 175 },
      mental: { positioning: 175, adaptability: 170, composure: 170, communication: 175, aggression: 180 },
      physical: { reactionTime: 185, dexterity: 190, consistency: 185, injuryResistance: 180 },
    },
  },

  // --- Academy / Tier 2 Prospects (16-20) ---
  {
    id: "p16",
    name: "Egor 'flamie' Vasilyev",
    age: 26,
    nationality: "Russia",
    role: "Rifler",
    skills: {
      technical: { shooting: 160, crosshairPlacement: 160, sprayControl: 165, utilityUsage: 150, firstBulletPrecision: 155, movement: 155, clutching: 160 },
      mental: { positioning: 160, adaptability: 150, composure: 155, communication: 150, aggression: 140 },
      physical: { reactionTime: 160, dexterity: 160, consistency: 150, injuryResistance: 160 },
    },
  },
  {
    id: "p17",
    name: "Owen 'oBo' Schlatter",
    age: 20,
    nationality: "USA",
    role: "Entry Fragger",
    skills: {
      technical: { shooting: 170, crosshairPlacement: 175, sprayControl: 165, utilityUsage: 140, firstBulletPrecision: 175, movement: 180, clutching: 150 },
      mental: { positioning: 150, adaptability: 140, composure: 130, communication: 130, aggression: 190 },
      physical: { reactionTime: 190, dexterity: 185, consistency: 140, injuryResistance: 150 },
    },
  },
  {
    id: "p18",
    name: "Aurélien 'afro' Drapier",
    age: 24,
    nationality: "France",
    role: "AWPer",
    skills: {
      technical: { shooting: 165, crosshairPlacement: 160, sprayControl: 150, utilityUsage: 155, firstBulletPrecision: 170, movement: 160, clutching: 160 },
      mental: { positioning: 165, adaptability: 160, composure: 165, communication: 155, aggression: 140 },
      physical: { reactionTime: 175, dexterity: 160, consistency: 165, injuryResistance: 160 },
    },
  },
  {
    id: "p19",
    name: "Lucas 'Gla1ve' Rossander",
    age: 28,
    nationality: "Denmark",
    role: "IGL",
    skills: {
      technical: { shooting: 140, crosshairPlacement: 145, sprayControl: 140, utilityUsage: 190, firstBulletPrecision: 135, movement: 150, clutching: 170 },
      mental: { positioning: 180, adaptability: 190, composure: 185, communication: 195, aggression: 150 },
      physical: { reactionTime: 145, dexterity: 140, consistency: 150, injuryResistance: 140 },
    },
  },
  {
    id: "p20",
    name: "Tsvetelin 'CeRq' Dimitrov",
    age: 24,
    nationality: "Bulgaria",
    role: "AWPer",
    skills: {
      technical: { shooting: 160, crosshairPlacement: 155, sprayControl: 145, utilityUsage: 145, firstBulletPrecision: 165, movement: 170, clutching: 155 },
      mental: { positioning: 155, adaptability: 150, composure: 145, communication: 145, aggression: 160 },
      physical: { reactionTime: 180, dexterity: 170, consistency: 140, injuryResistance: 150 },
    },
  },

  // --- Low Tier / Amateurs (21-25) ---
  {
    id: "p21",
    name: "Bot 'Brad'",
    age: 18,
    nationality: "USA",
    role: "Support",
    skills: {
      technical: { shooting: 100, crosshairPlacement: 100, sprayControl: 90, utilityUsage: 80, firstBulletPrecision: 90, movement: 100, clutching: 80 },
      mental: { positioning: 100, adaptability: 90, composure: 90, communication: 80, aggression: 120 },
      physical: { reactionTime: 120, dexterity: 100, consistency: 80, injuryResistance: 100 },
    },
  },
  {
    id: "p22",
    name: "Bot 'Chad'",
    age: 19,
    nationality: "UK",
    role: "Entry Fragger",
    skills: {
      technical: { shooting: 110, crosshairPlacement: 105, sprayControl: 100, utilityUsage: 60, firstBulletPrecision: 100, movement: 110, clutching: 70 },
      mental: { positioning: 90, adaptability: 80, composure: 70, communication: 70, aggression: 180 },
      physical: { reactionTime: 130, dexterity: 110, consistency: 70, injuryResistance: 90 },
    },
  },
  {
    id: "p23",
    name: "Bot 'Vlad'",
    age: 20,
    nationality: "Russia",
    role: "Rifler",
    skills: {
      technical: { shooting: 105, crosshairPlacement: 100, sprayControl: 110, utilityUsage: 70, firstBulletPrecision: 95, movement: 90, clutching: 75 },
      mental: { positioning: 95, adaptability: 85, composure: 80, communication: 60, aggression: 140 },
      physical: { reactionTime: 125, dexterity: 100, consistency: 80, injuryResistance: 100 },
    },
  },
  {
    id: "p24",
    name: "Bot 'Thad'",
    age: 21,
    nationality: "Germany",
    role: "AWPer",
    skills: {
      technical: { shooting: 115, crosshairPlacement: 110, sprayControl: 80, utilityUsage: 50, firstBulletPrecision: 120, movement: 80, clutching: 85 },
      mental: { positioning: 80, adaptability: 70, composure: 75, communication: 50, aggression: 100 },
      physical: { reactionTime: 135, dexterity: 90, consistency: 60, injuryResistance: 80 },
    },
  },
  {
    id: "p25",
    name: "Bot 'Kyle'",
    age: 18,
    nationality: "USA",
    role: "Lurker",
    skills: {
      technical: { shooting: 95, crosshairPlacement: 90, sprayControl: 85, utilityUsage: 90, firstBulletPrecision: 85, movement: 95, clutching: 90 },
      mental: { positioning: 110, adaptability: 100, composure: 100, communication: 100, aggression: 110 },
      physical: { reactionTime: 110, dexterity: 95, consistency: 90, injuryResistance: 90 },
    },
  },
];
