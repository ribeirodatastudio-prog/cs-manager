export interface Zone {
  id: string;
  name: string;
  x: number; // Visual X coordinate (0-100 or specific pixel grid, let's assume 0-1000 for granularity)
  y: number; // Visual Y coordinate
  connections: string[]; // IDs of adjacent zones
  cover: number; // 0.0 to 1.0 (0% to 100% cover bonus)
}

export interface MapData {
  id: string;
  name: string;
  zones: Zone[];
  spawnPoints: {
    CT: string; // Zone ID
    T: string; // Zone ID
  };
}
