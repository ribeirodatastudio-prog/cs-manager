import navMeshData from "@/data/de_dust2_web.json";

// Type definition for the Nav Mesh structure
export interface NavMeshNode {
  pos: [number, number]; // [x, y]
  adj: number[];         // Neighbor IDs
}

export interface NavMesh {
  [key: string]: NavMeshNode;
}

// 1. Calculate Mesh Bounds from RAW Data
// We cast to unknown first to bypass TS inference overlap check
const rawData = navMeshData as unknown as Record<string, { pos: number[], adj: number[] }>;
const rawPositions = Object.values(rawData).map(n => n.pos);

const minX = Math.min(...rawPositions.map(p => p[0]));
const maxX = Math.max(...rawPositions.map(p => p[0]));
const minY = Math.min(...rawPositions.map(p => p[1]));
const maxY = Math.max(...rawPositions.map(p => p[1]));

export const MESH_BOUNDS = { minX, maxX, minY, maxY };

// Target Screen/Canvas Dimensions
const TARGET_SIZE = 1000;

// Dynamic Scaling Factors
const scaleX = TARGET_SIZE / (maxX - minX);
const scaleY = TARGET_SIZE / (maxY - minY);

/**
 * Transforms Source Engine Game Coordinates to 1000x1000 SVG Coordinates.
 */
export const transformGameToSVG = (x: number, y: number): { x: number, y: number } => {
  const relativeX = x - minX;
  const relativeY = y - minY;

  const svgX = relativeX * scaleX;
  const svgY = relativeY * scaleY;

  return { x: svgX, y: svgY };
};

// 2. Create Transformed Mesh (In 0-1000 Coordinate Space)
// This allows the rest of the engine (Pathfinder, Bots) to work in the visual coordinate space directly.
export const NAV_MESH: NavMesh = {};

Object.entries(rawData).forEach(([key, val]) => {
  // Ensure we treat the number[] as [number, number] for the transform
  const { x, y } = transformGameToSVG(val.pos[0], val.pos[1]);
  NAV_MESH[key] = {
    pos: [x, y],
    adj: val.adj
  };
});

// Helper
export const getTransformScale = () => ({ scaleX, scaleY });
