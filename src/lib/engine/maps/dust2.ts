import { MapData } from "../types";

const c = (to: string, sightline: boolean = true) => ({ to, sightline });

export const DUST2_MAP: MapData = {
  id: "dust2",
  name: "Dust II",
  spawnPoints: {
    T: "t_spawn",
    CT: "ct_spawn",
  },
  bombSites: {
    A: "a_site",
    B: "b_site"
  },
  strategies: {
    split: {
      A: [
        { name: "Long", pincerPoint: "long_doors" },
        { name: "Short", pincerPoint: "a_short" }
      ],
      B: [
        { name: "Tunnels", pincerPoint: "upper_tunnels" },
        { name: "Mid", pincerPoint: "mid_doors" }
      ]
    }
  },
  postPlantPositions: {
    A: ["ct_spawn", "a_ramp", "long_doors"],
    B: ["b_window", "b_doors", "mid_doors"]
  },
  zones: [
    // T Side
    {
      id: "t_spawn",
      name: "T Spawn",
      x: 500,
      y: 50,
      connections: [c("top_mid"), c("outside_tunnels"), c("outside_long")],
      cover: 0.2,
    },
    {
      id: "outside_long",
      name: "Outside Long",
      x: 800,
      y: 100,
      connections: [c("t_spawn"), c("long_doors")],
      cover: 0.3,
    },
    {
      id: "long_doors",
      name: "Long Doors",
      x: 900,
      y: 200,
      connections: [c("outside_long"), c("long_a")],
      cover: 0.8, // Good choke point
    },
    {
      id: "long_a",
      name: "Long A",
      x: 900,
      y: 500,
      connections: [c("long_doors"), c("a_ramp")],
      cover: 0.2, // Open area
    },
    {
      id: "a_ramp",
      name: "A Ramp",
      x: 850,
      y: 700,
      connections: [c("long_a"), c("a_site")],
      cover: 0.4,
    },

    // A Site
    {
      id: "a_site",
      name: "A Site",
      x: 800,
      y: 800,
      connections: [c("a_ramp"), c("a_short"), c("ct_spawn")],
      cover: 0.7, // Boxes and cover
    },

    // Short / Cat
    {
      id: "a_short",
      name: "A Short",
      x: 700,
      y: 700,
      connections: [c("a_site"), c("catwalk")],
      cover: 0.5,
    },
    {
      id: "catwalk",
      name: "Catwalk",
      x: 600,
      y: 600,
      connections: [c("a_short"), c("mid"), c("lower_tunnels")],
      cover: 0.3,
    },

    // Mid
    {
      id: "top_mid",
      name: "Top Mid",
      x: 500,
      y: 200,
      connections: [c("t_spawn"), c("mid")],
      cover: 0.4,
    },
    {
      id: "mid",
      name: "Mid",
      x: 500,
      y: 500,
      connections: [c("top_mid"), c("catwalk"), c("mid_doors"), c("lower_tunnels")],
      cover: 0.1, // Suicide runs
    },
    {
      id: "mid_doors",
      name: "Mid Doors",
      x: 500,
      y: 700,
      connections: [c("mid"), c("ct_spawn"), c("b_window"), c("b_doors")],
      cover: 0.9, // Door cover
    },

    // B Area
    {
      id: "outside_tunnels",
      name: "Outside Tunnels",
      x: 200,
      y: 100,
      connections: [c("t_spawn"), c("upper_tunnels")],
      cover: 0.3,
    },
    {
      id: "upper_tunnels",
      name: "Upper Tunnels",
      x: 150,
      y: 300,
      connections: [c("outside_tunnels"), c("b_tunnels"), c("lower_tunnels")],
      cover: 0.8,
    },
    {
      id: "lower_tunnels",
      name: "Lower Tunnels",
      x: 350,
      y: 400,
      connections: [c("upper_tunnels"), c("mid"), c("catwalk")],
      cover: 0.6,
    },
    {
      id: "b_tunnels",
      name: "B Tunnels",
      x: 150,
      y: 600,
      connections: [c("upper_tunnels"), c("b_site")],
      cover: 0.7,
    },
    {
      id: "b_site",
      name: "B Site",
      x: 150,
      y: 800,
      connections: [c("b_tunnels"), c("b_window"), c("b_doors")],
      cover: 0.8,
    },
    {
      id: "b_window",
      name: "B Window",
      x: 300,
      y: 800,
      connections: [c("b_site"), c("mid_doors"), c("ct_spawn")],
      cover: 0.6,
    },
    {
      id: "b_doors",
      name: "B Doors",
      x: 200,
      y: 750,
      connections: [c("b_site"), c("mid_doors")],
      cover: 0.5
    },

    // CT Spawn
    {
      id: "ct_spawn",
      name: "CT Spawn",
      x: 500,
      y: 900,
      connections: [c("a_site"), c("mid_doors"), c("b_window")],
      cover: 0.5,
    },
  ],
};
