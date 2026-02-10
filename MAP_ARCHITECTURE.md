# Map Architecture & AI Documentation

This document outlines the architecture for the map navigation, pathfinding, and artificial intelligence systems used in the Counter-Strike 2 strategy simulation engine. The system is designed around a navigation mesh extracted from the game's actual data, overlayed with a logical zone system for strategic decision-making.

## 1. Navigation Mesh

The core of the movement system is a navigation mesh (NavMesh) that represents the walkable areas of the map.

### Data Storage
The raw navigation data is stored in `src/data/de_dust2_web.json`. This JSON file contains a graph of navigation nodes representing the map's geometry.

**Structure:**
The data is a dictionary where keys are unique Node IDs (strings) and values are `NavNode` objects:
```typescript
interface NavNode {
  id: string;
  pos: [number, number]; // [x, y] coordinates in CS2 World Units
  adj: number[];         // Array of adjacent Node IDs
}
```

### Loading Process (`EnhancedNavMeshManager`)
The `EnhancedNavMeshManager` class (Singleton) is responsible for loading and processing this data.
1.  **Loading**: It fetches `de_dust2_web.json` (or accepts raw data).
2.  **Transformation**: If the data is detected as "raw" (CS2 coordinates), it may apply a transformation to visual coordinates depending on the configuration, though the engine primarily operates in the coordinate system defined by `DUST2_COORDINATES`.
3.  **Spatial Partitioning**: Nodes are indexed into a spatial grid (`spatialGrid`) with a cell size of 500 units to optimize nearest-node lookups (`getClosestNode`).
4.  **Vision Pre-computation**: It asynchronously computes visibility between nodes using raycasting to populate a `visionCache`. This allows for fast line-of-sight checks during the simulation.

## 2. Pathfinding

Pathfinding is handled by `EnhancedNavMeshManager` and provides optimal paths for bot movement.

### Algorithms
*   **A* (A-Star)**: The primary pathfinding algorithm used in `findPath(start, end)`. It uses the Euclidean distance between nodes as the heuristic.
*   **Path Smoothing**: After a raw path of nodes is found, `smoothPath()` post-processes it. It iterates through the path and removes intermediate nodes if a direct line-of-sight exists between non-adjacent waypoints, resulting in more natural movement.
*   **Dijkstra Distance Maps**: For frequently accessed targets (like Bomb Sites), the system pre-computes distance maps using Dijkstra's algorithm. This allows `getPathDistance` to return the walking distance in O(1) time for these specific targets, significantly optimizing tactical decision-making.

## 3. Map Structure & Zones

While the NavMesh handles physical movement, the `GameMap` class manages the high-level logical structure of the map using "Zones".

### GameMap Class
`src/lib/engine/GameMap.ts`
The `GameMap` acts as the interface for querying map data. It wraps the low-level NavMesh queries and provides higher-level zone information.

### Zones
Defined in `src/lib/engine/maps/dust2.ts`, zones represent named areas of the map (e.g., "Long A", "Catwalk", "Mid Doors").

**Zone Interface:**
```typescript
interface Zone {
  id: string;
  name: string;
  x: number;       // Visual X coordinate
  y: number;       // Visual Y coordinate
  connections: Connection[]; // Logical connections to other zones
  cover: number;   // 0.0 - 1.0 (Safety rating)
}
```

### Strategic Points
Specific points of interest are identified by their Zone IDs in `DUST2_MAP`:
*   **Spawn Points**: Defined in `spawnPoints` (e.g., `T: "t_spawn"`, `CT: "ct_spawn"`).
*   **Bomb Sites**: Defined in `bombSites` (e.g., `A: "a_site"`, `B: "b_site"`).
*   **Strategic Positions**: Key positions for holding angles or executing strategies (e.g., `long_corner`, `xbox`).

## 4. Coordinate Systems

The application deals with two primary coordinate systems: the internal navigation coordinates (based on CS2 world units) and the visual display coordinates.

### Constants
Defined in `src/lib/engine/cs2Constants.ts` under `DUST2_COORDINATES`.

*   **Nav Bounds**:
    *   X: [-2200, 1700]
    *   Y: [-3700, 900]
*   **Visual Dimensions**: 1024x1024 pixels.

### Transformation Logic
The `DUST2_COORDINATES` object provides helper functions to convert between these systems:

1.  **Nav to Visual**:
    *   Normalizes the Nav (World) X/Y based on the min/max bounds.
    *   Scales the normalized value by the visual dimensions (1024).
    *   `x = ((navX - minX) / width) * visualWidth`

2.  **Visual to Nav**:
    *   Normalizes the Visual X/Y by the visual dimensions.
    *   Scales by the Nav bounds width/height and adds the offset.
    *   `navX = (visualX / visualWidth) * width + minX`

## 5. AI Classes & Architecture

The AI is composed of several layered systems, ranging from individual bot logic to high-level team strategy.

### Bot (`src/lib/engine/Bot.ts`)
Represents an individual agent in the simulation.
*   **State Machine**: Uses `BotAIState` (e.g., `DEFAULT`, `HOLDING_ANGLE`, `PLANTING`, `DEFUSING`) to determine behavior.
*   **Movement**: executes movement along the path determined by `EnhancedNavMeshManager`.
*   **Inventory**: Manages weapons and utility.

### BotVisionSystem (`src/lib/engine/BotVisionSystem.ts`)
Handles the perception of the agents.
*   **Raycasting**: performs raycasts against the NavMesh and map geometry to determine line-of-sight.
*   **Field of View**: Checks if targets are within the bot's view cone.
*   **Reaction Time**: Simulates human-like reaction times based on player skills.

### TacticalAI (`src/lib/engine/TacticalAI.ts`)
Provides high-level tactical logic for bots.
*   **Angle Clearing**: Determines which angles a bot should check when entering a new area.
*   **Positioning**: identifying valid cover and hold positions.
*   **Utility Usage**: Logic for throwing grenades (smokes, flashes) based on strategy.

### TacticsManager (`src/lib/engine/TacticsManager.ts`)
Orchestrates team-wide strategies.
*   **Role Assignment**: Assigns roles (Entry, Support, AWP, etc.) to bots.
*   **Strategies**: Defines and executes high-level plans (e.g., "Split A", "Rush B").
*   **Phases**: Manages the progression of a round strategy (Setup -> Execute -> Post-Plant).

### MatchSimulator (`src/lib/engine/MatchSimulator.ts`)
The main game loop.
*   **Orchestration**: Updates all bots, projectiles, and game state every tick.
*   **Event Handling**: Processes game events (kills, bomb plants).
*   **Economy**: Manages the team economy via `TeamEconomyManager`.
*   **Combat Resolution**: Uses `DuelEngine` to calculate the outcome of engagements.
