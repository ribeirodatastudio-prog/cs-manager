import navMeshData from "@/data/de_dust2_web.json";
import { DUST2_COORDINATES } from "./cs2Constants";

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

// Use Hardcoded Bounds from CS2 Constants
export const MESH_BOUNDS = {
  minX: DUST2_COORDINATES.NAV_MIN_X,
  maxX: DUST2_COORDINATES.NAV_MAX_X,
  minY: DUST2_COORDINATES.NAV_MIN_Y,
  maxY: DUST2_COORDINATES.NAV_MAX_Y
};

// Target Screen/Canvas Dimensions (from Constants)
const TARGET_WIDTH = DUST2_COORDINATES.VISUAL_WIDTH;
const TARGET_HEIGHT = DUST2_COORDINATES.VISUAL_HEIGHT;

/**
 * Transforms Source Engine Game Coordinates to Visual Coordinates (1024x1024).
 */
export const transformGameToSVG = (x: number, y: number): { x: number, y: number } => {
  return DUST2_COORDINATES.navToVisual(x, y);
};

// 2. Create Transformed Mesh (In Visual Coordinate Space)
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

// Helper - Derived from constants
export const getTransformScale = () => {
  const width = DUST2_COORDINATES.NAV_MAX_X - DUST2_COORDINATES.NAV_MIN_X;
  const height = DUST2_COORDINATES.NAV_MAX_Y - DUST2_COORDINATES.NAV_MIN_Y;
  return {
    scaleX: DUST2_COORDINATES.VISUAL_WIDTH / width,
    scaleY: DUST2_COORDINATES.VISUAL_HEIGHT / height
  };
};
