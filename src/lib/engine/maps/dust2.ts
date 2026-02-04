import { MapData } from "../types";

export const DUST2_MAP: MapData = {
  id: "dust2",
  name: "Dust II",
  spawnPoints: {
    T: "t_spawn",
    CT: "ct_spawn",
  },
  zones: [
    // T Side
    {
      id: "t_spawn",
      name: "T Spawn",
      x: 500,
      y: 50,
      connections: ["top_mid", "outside_tunnels", "outside_long"],
      cover: 0.2,
    },
    {
      id: "outside_long",
      name: "Outside Long",
      x: 800,
      y: 100,
      connections: ["t_spawn", "long_doors"],
      cover: 0.3,
    },
    {
      id: "long_doors",
      name: "Long Doors",
      x: 900,
      y: 200,
      connections: ["outside_long", "long_a"],
      cover: 0.8, // Good choke point
    },
    {
      id: "long_a",
      name: "Long A",
      x: 900,
      y: 500,
      connections: ["long_doors", "a_ramp"],
      cover: 0.2, // Open area
    },
    {
      id: "a_ramp",
      name: "A Ramp",
      x: 850,
      y: 700,
      connections: ["long_a", "a_site"],
      cover: 0.4,
    },

    // A Site
    {
      id: "a_site",
      name: "A Site",
      x: 800,
      y: 800,
      connections: ["a_ramp", "a_short", "ct_spawn"],
      cover: 0.7, // Boxes and cover
    },

    // Short / Cat
    {
      id: "a_short",
      name: "A Short",
      x: 700,
      y: 700,
      connections: ["a_site", "catwalk"],
      cover: 0.5,
    },
    {
      id: "catwalk",
      name: "Catwalk",
      x: 600,
      y: 600,
      connections: ["a_short", "mid", "lower_tunnels"], // Connects to lower tunnel stairs area
      cover: 0.3,
    },

    // Mid
    {
      id: "top_mid",
      name: "Top Mid",
      x: 500,
      y: 200,
      connections: ["t_spawn", "mid"],
      cover: 0.4,
    },
    {
      id: "mid",
      name: "Mid",
      x: 500,
      y: 500,
      connections: ["top_mid", "catwalk", "mid_doors", "lower_tunnels"],
      cover: 0.1, // Suicide runs
    },
    {
      id: "mid_doors",
      name: "Mid Doors",
      x: 500,
      y: 700,
      connections: ["mid", "ct_spawn", "b_window", "b_doors"], // Simplified connection to B
      cover: 0.9, // Door cover
    },

    // B Area
    {
      id: "outside_tunnels",
      name: "Outside Tunnels",
      x: 200,
      y: 100,
      connections: ["t_spawn", "upper_tunnels"],
      cover: 0.3,
    },
    {
      id: "upper_tunnels",
      name: "Upper Tunnels",
      x: 150,
      y: 300,
      connections: ["outside_tunnels", "b_tunnels", "lower_tunnels"],
      cover: 0.8,
    },
    {
      id: "lower_tunnels",
      name: "Lower Tunnels",
      x: 350,
      y: 400,
      connections: ["upper_tunnels", "mid", "catwalk"],
      cover: 0.6,
    },
    {
      id: "b_tunnels",
      name: "B Tunnels",
      x: 150,
      y: 600,
      connections: ["upper_tunnels", "b_site"],
      cover: 0.7,
    },
    {
      id: "b_site",
      name: "B Site",
      x: 150,
      y: 800,
      connections: ["b_tunnels", "b_window", "b_doors"],
      cover: 0.8,
    },
    {
      id: "b_window",
      name: "B Window",
      x: 300,
      y: 800,
      connections: ["b_site", "mid_doors", "ct_spawn"],
      cover: 0.6,
    },
    {
      id: "b_doors", // Adding b_doors to connect site to mid/ct area
      name: "B Doors",
      x: 200,
      y: 750,
      connections: ["b_site", "mid_doors"],
      cover: 0.5
    },

    // CT Spawn
    {
      id: "ct_spawn",
      name: "CT Spawn",
      x: 500,
      y: 900,
      connections: ["a_site", "mid_doors", "b_window"],
      cover: 0.5,
    },
  ],
};
