import { Player } from "@/types";

/**
 * Mock data containing 5 diverse player profiles for the Counter-Strike Manager.
 * Includes profiles for: Star AWPer, Support, Entry Fragger, IGL, and Lurker.
 */
export const MOCK_PLAYERS: Player[] = [
  {
    id: "p1",
    name: "Mathieu 'ZywOo' Herbaut",
    age: 23,
    nationality: "France",
    role: "Star AWPer",
    skills: {
      technical: {
        shooting: 199,
        crosshairPlacement: 196,
        sprayControl: 192,
        utilityUsage: 170,
        firstBulletPrecision: 195,
        movement: 188,
        clutching: 198,
      },
      mental: {
        positioning: 190,
        adaptability: 195,
        composure: 198,
        communication: 160,
        aggression: 150,
      },
      physical: {
        reactionTime: 197,
        dexterity: 190,
        consistency: 199,
        injuryResistance: 180,
      },
    },
  },
  {
    id: "p2",
    name: "Finn 'karrigan' Andersen",
    age: 33,
    nationality: "Denmark",
    role: "IGL",
    skills: {
      technical: {
        shooting: 150,
        crosshairPlacement: 155,
        sprayControl: 145,
        utilityUsage: 195,
        firstBulletPrecision: 140,
        movement: 160,
        clutching: 165,
      },
      mental: {
        positioning: 185,
        adaptability: 199,
        composure: 180,
        communication: 200,
        aggression: 160,
      },
      physical: {
        reactionTime: 140,
        dexterity: 150,
        consistency: 160,
        injuryResistance: 150,
      },
    },
  },
  {
    id: "p3",
    name: "Nikola 'NiKo' Kovač",
    age: 27,
    nationality: "Bosnia",
    role: "Entry Fragger",
    skills: {
      technical: {
        shooting: 198,
        crosshairPlacement: 200,
        sprayControl: 195,
        utilityUsage: 165,
        firstBulletPrecision: 199,
        movement: 180,
        clutching: 185,
      },
      mental: {
        positioning: 170,
        adaptability: 175,
        composure: 160,
        communication: 170,
        aggression: 195,
      },
      physical: {
        reactionTime: 190,
        dexterity: 192,
        consistency: 185,
        injuryResistance: 175,
      },
    },
  },
  {
    id: "p4",
    name: "Ilya 'Perfecto' Zalutskiy",
    age: 24,
    nationality: "Russia",
    role: "Support",
    skills: {
      technical: {
        shooting: 175,
        crosshairPlacement: 170,
        sprayControl: 175,
        utilityUsage: 198,
        firstBulletPrecision: 165,
        movement: 170,
        clutching: 195,
      },
      mental: {
        positioning: 190,
        adaptability: 185,
        composure: 195,
        communication: 190,
        aggression: 130,
      },
      physical: {
        reactionTime: 170,
        dexterity: 175,
        consistency: 190,
        injuryResistance: 185,
      },
    },
  },
  {
    id: "p5",
    name: "Robin 'ropz' Kool",
    age: 24,
    nationality: "Estonia",
    role: "Lurker",
    skills: {
      technical: {
        shooting: 190,
        crosshairPlacement: 195,
        sprayControl: 188,
        utilityUsage: 175,
        firstBulletPrecision: 192,
        movement: 185,
        clutching: 190,
      },
      mental: {
        positioning: 198,
        adaptability: 180,
        composure: 190,
        communication: 175,
        aggression: 140,
      },
      physical: {
        reactionTime: 185,
        dexterity: 188,
        consistency: 192,
        injuryResistance: 180,
      },
    },
  },
];
