/**
 * Enhanced Navigation Mesh Manager with Vision System
 * Provides pathfinding, line-of-sight, and tactical position analysis
 */
import { Point } from "./types";
import { transformGameToSVG } from "../utils/navMesh";

export interface NavNode {
  id: string;
  pos: [number, number];
  adj: number[];
  // Enhanced properties
  visibleNodes?: Set<string>; // Pre-computed visible nodes
  coverScore?: number; // How much cover this position provides
  isChokepoint?: boolean; // Strategic importance
  zoneId?: string; // Which tactical zone this belongs to
}

export interface NavMesh {
  nodes: Map<string, NavNode>;
  adjacencyMap: Map<string, Set<string>>;
  // Vision cache for performance
  visionCache: Map<string, Set<string>>;
  // Distance cache: TargetNodeID -> Map<SourceNodeID, distance>
  distanceMaps: Map<string, Map<string, number>>;
}

/**
 * Enhanced NavMeshManager with vision and tactical analysis
 */
export class EnhancedNavMeshManager {
  private static instance: EnhancedNavMeshManager;
  private navMesh: NavMesh | null = null;
  private isLoaded = false;

  // Configuration
  private readonly WALKABLE_THRESHOLD = 30; // Distance to nearest node to be walkable
  private readonly VISION_RAY_STEPS = 15; // Accuracy of vision checks
  private readonly MAX_VISION_DISTANCE = 3000; // Maximum sight distance

  // Spatial Partitioning
  private readonly GRID_CELL_SIZE = 500;
  private spatialGrid: Map<string, NavNode[]> = new Map();

  private constructor() {}

  static getInstance(): EnhancedNavMeshManager {
    if (!EnhancedNavMeshManager.instance) {
      EnhancedNavMeshManager.instance = new EnhancedNavMeshManager();
    }
    return EnhancedNavMeshManager.instance;
  }

  /**
   * Load and enhance navigation mesh with vision data
   */
  async loadNavMesh(navData?: Record<string, { pos: [number, number]; adj: number[] }>): Promise<void> {
    try {
      let data = navData;
      let isRaw = false;

      if (!data) {
        // Load from public folder
        const response = await fetch('/de_dust2_web.json');
        if (!response.ok) throw new Error('Failed to load navigation mesh');
        data = await response.json();
        isRaw = true; // Data loaded from JSON is assumed to be in Game Coordinates
      } else {
        // If data is passed, we check if it needs transformation.
        // If it comes from NAV_MESH export in navMesh.ts, it is already transformed.
        // We can check coordinate range to guess.
        const first = Object.values(data)[0];
        if (first && (first.pos[0] < -500 || first.pos[0] > 1500)) {
           isRaw = true;
        }
      }

      if (!data) throw new Error("No nav data found");

      const nodes = new Map<string, NavNode>();
      const adjacencyMap = new Map<string, Set<string>>();
      const visionCache = new Map<string, Set<string>>();
      const distanceMaps = new Map<string, Map<string, number>>();

      // Reset spatial grid
      this.spatialGrid.clear();

      // Build basic navmesh
      for (const [id, nodeData] of Object.entries(data)) {
        let pos: [number, number] = nodeData.pos;

        if (isRaw) {
             const transformed = transformGameToSVG(pos[0], pos[1]);
             pos = [transformed.x, transformed.y];
        }

        const node: NavNode = {
          id,
          pos: pos,
          adj: nodeData.adj,
          visibleNodes: new Set<string>()
        };

        nodes.set(id, node);

        // Add to spatial grid
        const cellKey = this.getCellKey(pos[0], pos[1]);
        if (!this.spatialGrid.has(cellKey)) {
            this.spatialGrid.set(cellKey, []);
        }
        this.spatialGrid.get(cellKey)!.push(node);

        const adjSet = new Set<string>();
        nodeData.adj.forEach(adjId => adjSet.add(adjId.toString()));
        adjacencyMap.set(id, adjSet);
      }

      this.navMesh = { nodes, adjacencyMap, visionCache, distanceMaps };

      // Enhance with vision and tactical data
      this.identifyChokepoints();

      // Run vision computation in background
      this.computeVisionData().then(() => {
          this.computeCoverScores();
          console.log(`Vision computation complete for ${nodes.size} nodes`);
      });

      this.isLoaded = true;
      console.log(`Enhanced navigation mesh loaded: ${nodes.size} nodes (Vision computing in background)`);
    } catch (error) {
      console.error('Failed to load navigation mesh:', error);
      throw error;
    }
  }

  /**
   * Pre-compute which nodes can see which other nodes
   * This is expensive but done once at load time
   */
  private async computeVisionData(): Promise<void> {
    if (!this.navMesh) return;

    const nodes = Array.from(this.navMesh.nodes.values());
    let computed = 0;

    // Optimization: Don't log every step, or use a faster check?
    // Doing O(N^2) for N=1000 is 500,000 checks.
    // Each check does raycast.
    // This might take a few seconds.
    // We can yield to event loop.

    const BATCH_SIZE = 50;

    for (let i = 0; i < nodes.length; i++) {
      const nodeA = nodes[i];
      const visibleSet = this.navMesh.visionCache.get(nodeA.id) || new Set<string>();

      for (let j = i + 1; j < nodes.length; j++) {
        const nodeB = nodes[j];

        // Distance check first for performance
        const dx = nodeA.pos[0] - nodeB.pos[0];
        const dy = nodeA.pos[1] - nodeB.pos[1];
        const distSq = dx * dx + dy * dy;

        if (distSq > this.MAX_VISION_DISTANCE * this.MAX_VISION_DISTANCE) {
          continue;
        }

        // Check line of sight
        if (this.hasLineOfSightBetweenNodes(nodeA, nodeB)) {
          visibleSet.add(nodeB.id);

          let setB = this.navMesh.visionCache.get(nodeB.id);
          if (!setB) {
              setB = new Set<string>();
              this.navMesh.visionCache.set(nodeB.id, setB);
          }
          setB.add(nodeA.id);

          if (!nodeB.visibleNodes) nodeB.visibleNodes = setB;
        }

        computed++;
      }

      nodeA.visibleNodes = visibleSet;
      this.navMesh.visionCache.set(nodeA.id, visibleSet);

      if (computed % BATCH_SIZE === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }

  /**
   * Check if two nodes have line of sight to each other
   */
  private hasLineOfSightBetweenNodes(nodeA: NavNode, nodeB: NavNode): boolean {
    const startX = nodeA.pos[0];
    const startY = nodeA.pos[1];
    const endX = nodeB.pos[0];
    const endY = nodeB.pos[1];

    const dx = endX - startX;
    const dy = endY - startY;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist < 1) return true;

    // Sample points along the ray
    // Use fixed step size relative to distance
    const steps = Math.max(5, Math.ceil(dist / 20)); // Check every ~20 units

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const checkX = startX + dx * t;
      const checkY = startY + dy * t;

      // If any intermediate point is not walkable, no LOS
      if (!this.isWalkable({ x: checkX, y: checkY }, 20)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Identify strategic chokepoints (nodes with few connections)
   */
  private identifyChokepoints(): void {
    if (!this.navMesh) return;

    for (const [id, node] of this.navMesh.nodes) {
      // A chokepoint has few connections relative to neighbors
      const avgNeighborConnections = this.getAverageNeighborConnections(id);
      const myConnections = node.adj.length;

      // If this node has significantly fewer connections than its neighbors
      node.isChokepoint = myConnections < avgNeighborConnections * 0.6;
    }
  }

  /**
   * Get average number of connections for neighboring nodes
   */
  private getAverageNeighborConnections(nodeId: string): number {
    if (!this.navMesh) return 0;

    const node = this.navMesh.nodes.get(nodeId);
    if (!node) return 0;

    let total = 0;
    let count = 0;

    for (const adjId of node.adj) {
      const adjNode = this.navMesh.nodes.get(adjId.toString());
      if (adjNode) {
        total += adjNode.adj.length;
        count++;
      }
    }

    return count > 0 ? total / count : 0;
  }

  /**
   * Compute cover scores based on visibility
   */
  private computeCoverScores(): void {
    if (!this.navMesh) return;

    for (const node of this.navMesh.nodes.values()) {
      // Cover score is inversely related to how many nodes can see this position
      const visibleCount = node.visibleNodes?.size || 0;
      const maxVisible = this.navMesh.nodes.size;

      // Normalize to 0-1, where 1 is best cover (least visible)
      node.coverScore = 1 - (visibleCount / (maxVisible || 1));
    }
  }

  /**
   * Get spatial grid cell key
   */
  private getCellKey(x: number, y: number): string {
      const cx = Math.floor(x / this.GRID_CELL_SIZE);
      const cy = Math.floor(y / this.GRID_CELL_SIZE);
      return `${cx}_${cy}`;
  }

  /**
   * Get candidates from spatial grid (3x3 area)
   */
  private getGridCandidates(x: number, y: number): NavNode[] {
      const cx = Math.floor(x / this.GRID_CELL_SIZE);
      const cy = Math.floor(y / this.GRID_CELL_SIZE);
      const candidates: NavNode[] = [];

      for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
              const key = `${cx + dx}_${cy + dy}`;
              const cellNodes = this.spatialGrid.get(key);
              if (cellNodes) {
                  for (const node of cellNodes) {
                      candidates.push(node);
                  }
              }
          }
      }
      return candidates;
  }

  /**
   * Get the closest navigation node to a point
   */
  getClosestNode(point: Point): NavNode | null {
    if (!this.navMesh) return null;

    let closestNode: NavNode | null = null;
    let minDistance = Infinity;

    // Use spatial grid optimization
    const candidates = this.getGridCandidates(point.x, point.y);

    // If no candidates found in immediate vicinity (e.g. far off map), fallback to all nodes?
    // Or just return null? If the map is bounded, candidates should be found if point is reasonable.
    // If point is way outside, maybe we want the closest edge node?
    // Let's fallback to all nodes if candidates is empty, just to be safe.
    const nodesToCheck = candidates.length > 0 ? candidates : this.navMesh.nodes.values();

    for (const node of nodesToCheck) {
      const dx = node.pos[0] - point.x;
      const dy = node.pos[1] - point.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < minDistance) {
        minDistance = distance;
        closestNode = node;
      }
    }

    return closestNode;
  }

  /**
   * Check if a position is walkable
   */
  isWalkable(point: Point, threshold = this.WALKABLE_THRESHOLD): boolean {
    const closestNode = this.getClosestNode(point);
    if (!closestNode) return false;

    const dx = closestNode.pos[0] - point.x;
    const dy = closestNode.pos[1] - point.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance <= threshold;
  }

  /**
   * Check if there's line of sight between two points
   */
  hasLineOfSight(start: Point, end: Point): boolean {
    if (!this.navMesh) return false;

    // Get closest nodes
    const startNode = this.getClosestNode(start);
    const endNode = this.getClosestNode(end);

    if (!startNode || !endNode) return false;

    // Check cache first
    if (this.navMesh.visionCache.has(startNode.id)) {
      const visibleNodes = this.navMesh.visionCache.get(startNode.id);
      if (visibleNodes && visibleNodes.has(endNode.id)) {
        return true;
      }
    }

    // If not in cache, do raycast
    return this.hasLineOfSightBetweenNodes(startNode, endNode);
  }

  /**
   * Get all positions visible from a point
   */
  getVisiblePositions(point: Point, maxDistance?: number): Point[] {
    if (!this.navMesh) return [];

    const node = this.getClosestNode(point);
    if (!node || !node.visibleNodes) return [];

    const maxDist = maxDistance || this.MAX_VISION_DISTANCE;
    const visible: Point[] = [];

    for (const visibleNodeId of node.visibleNodes) {
      const visNode = this.navMesh.nodes.get(visibleNodeId);
      if (!visNode) continue;

      // Distance check
      const dx = visNode.pos[0] - point.x;
      const dy = visNode.pos[1] - point.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= maxDist) {
        visible.push({ x: visNode.pos[0], y: visNode.pos[1] });
      }
    }

    return visible;
  }

  /**
   * Pre-compute distances from a target node to all other nodes using Dijkstra
   * This allows O(1) distance lookups to this target
   */
  computeDistanceMap(targetNodeId: string): void {
    if (!this.navMesh) return;
    const targetNode = this.navMesh.nodes.get(targetNodeId);
    if (!targetNode) return;

    if (this.navMesh.distanceMaps.has(targetNodeId)) return; // Already computed

    const distances = new Map<string, number>();
    const nodes = this.navMesh.nodes;

    // Initialize distances
    for (const id of nodes.keys()) {
      distances.set(id, Infinity);
    }
    distances.set(targetNodeId, 0);

    // Dijkstra's Algorithm
    const unvisited = new Set<string>(nodes.keys());

    while (unvisited.size > 0) {
      // Find unvisited node with smallest distance
      // Optimization: For 2200 nodes, a linear scan is O(N), total O(N^2).
      // 2200^2 = ~4.8M ops, which is fast enough for pre-computation (approx 10-50ms)
      let current: string | null = null;
      let minDist = Infinity;

      for (const id of unvisited) {
        const d = distances.get(id) ?? Infinity;
        if (d < minDist) {
          minDist = d;
          current = id;
        }
      }

      if (!current || minDist === Infinity) break; // Remaining nodes are unreachable

      unvisited.delete(current);
      const currentNode = nodes.get(current)!;

      // Update neighbors
      const neighbors = this.navMesh.adjacencyMap.get(current);
      if (neighbors) {
        for (const neighborId of neighbors) {
          if (!unvisited.has(neighborId)) continue;

          const neighbor = nodes.get(neighborId)!;
          const dist = this.distance(currentNode, neighbor);
          const alt = minDist + dist;

          if (alt < (distances.get(neighborId) ?? Infinity)) {
            distances.set(neighborId, alt);
          }
        }
      }
    }

    this.navMesh.distanceMaps.set(targetNodeId, distances);
    console.log(`Pre-computed distances to node ${targetNodeId}`);
  }

  /**
   * Get efficient path distance between two points
   * Uses cached Dijkstra maps if available, otherwise falls back to A*
   */
  getPathDistance(start: Point, end: Point): number {
    if (!this.navMesh) return Infinity;

    const startNode = this.getClosestNode(start);
    const endNode = this.getClosestNode(end);

    if (!startNode || !endNode) return Infinity;
    if (startNode.id === endNode.id) {
       // Return linear distance if on same node (approx)
       return Math.sqrt(Math.pow(start.x - end.x, 2) + Math.pow(start.y - end.y, 2));
    }

    // Check if we have pre-computed distances to the end node
    const distanceMap = this.navMesh.distanceMaps.get(endNode.id);
    if (distanceMap) {
      const dist = distanceMap.get(startNode.id);
      if (dist !== undefined && dist !== Infinity) {
        return dist;
      }
    }

    // Fallback to finding path and calculating length
    const path = this.findPath(start, end);
    if (path.length === 0) return Infinity;

    let totalDist = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i+1];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        totalDist += Math.sqrt(dx*dx + dy*dy);
    }
    return totalDist;
  }

  /**
   * Find path between two points using A*
   */
  findPath(start: Point, end: Point): Point[] {
    if (!this.navMesh) return [];

    const startNode = this.getClosestNode(start);
    const endNode = this.getClosestNode(end);

    if (!startNode || !endNode) return [];
    if (startNode.id === endNode.id) return [end];

    // A* pathfinding
    const openSet = new Set<string>([startNode.id]);
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();

    gScore.set(startNode.id, 0);
    fScore.set(startNode.id, this.heuristic(startNode, endNode));

    while (openSet.size > 0) {
      // Find node with lowest fScore
      let current: string | null = null;
      let lowestF = Infinity;

      for (const nodeId of openSet) {
        const f = fScore.get(nodeId) ?? Infinity;
        if (f < lowestF) {
          lowestF = f;
          current = nodeId;
        }
      }

      if (!current) break;

      const currentNode = this.navMesh.nodes.get(current);
      if (!currentNode) break;

      if (current === endNode.id) {
        return this.reconstructPath(cameFrom, current, start, end);
      }

      openSet.delete(current);

      // Check all neighbors
      const adjacentIds = this.navMesh.adjacencyMap.get(current);
      if (!adjacentIds) continue;

      for (const neighborId of adjacentIds) {
        const neighbor = this.navMesh.nodes.get(neighborId);
        if (!neighbor) continue;

        const tentativeG = (gScore.get(current) ?? Infinity) +
                          this.distance(currentNode, neighbor);

        if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
          cameFrom.set(neighborId, current);
          gScore.set(neighborId, tentativeG);
          fScore.set(neighborId, tentativeG + this.heuristic(neighbor, endNode));

          if (!openSet.has(neighborId)) {
            openSet.add(neighborId);
          }
        }
      }
    }

    return [];
  }

  /**
   * Reconstruct and smooth the path
   */
  private reconstructPath(
    cameFrom: Map<string, string>,
    current: string,
    start: Point,
    end: Point
  ): Point[] {
    if (!this.navMesh) return [];

    const path: Point[] = [end];
    let curr = current;

    while (cameFrom.has(curr)) {
      const node = this.navMesh.nodes.get(curr);
      if (!node) break;

      path.unshift({ x: node.pos[0], y: node.pos[1] });
      curr = cameFrom.get(curr)!;
    }

    path.unshift(start);

    // Smooth the path
    return this.smoothPath(path);
  }

  /**
   * Smooth path by removing unnecessary waypoints
   */
  private smoothPath(path: Point[]): Point[] {
    if (path.length <= 2) return path;

    const smoothed: Point[] = [path[0]];
    let current = 0;

    while (current < path.length - 1) {
      let farthest = current + 1;

      // Find farthest directly reachable point
      for (let i = path.length - 1; i > current + 1; i--) {
        if (this.hasLineOfSight(path[current], path[i])) {
          farthest = i;
          break;
        }
      }

      smoothed.push(path[farthest]);
      current = farthest;
    }

    return smoothed;
  }

  /**
   * Get nodes within a radius
   */
  getNodesInRadius(center: Point, radius: number): NavNode[] {
    if (!this.navMesh) return [];

    const nodes: NavNode[] = [];
    const radiusSq = radius * radius;

    // Determine which grid cells to check
    const minX = Math.floor((center.x - radius) / this.GRID_CELL_SIZE);
    const maxX = Math.floor((center.x + radius) / this.GRID_CELL_SIZE);
    const minY = Math.floor((center.y - radius) / this.GRID_CELL_SIZE);
    const maxY = Math.floor((center.y + radius) / this.GRID_CELL_SIZE);

    for (let cx = minX; cx <= maxX; cx++) {
        for (let cy = minY; cy <= maxY; cy++) {
             const key = `${cx}_${cy}`;
             const cellNodes = this.spatialGrid.get(key);
             if (cellNodes) {
                 for (const node of cellNodes) {
                     const dx = node.pos[0] - center.x;
                     const dy = node.pos[1] - center.y;
                     const distSq = dx * dx + dy * dy;

                     if (distSq <= radiusSq) {
                         nodes.push(node);
                     }
                 }
             }
        }
    }

    return nodes;
  }

  /**
   * Find best cover position near a point
   */
  findBestCoverPosition(nearPoint: Point, radius: number = 200): Point | null {
    const nearbyNodes = this.getNodesInRadius(nearPoint, radius);

    if (nearbyNodes.length === 0) return null;

    // Find node with best cover score
    let bestNode: NavNode | null = null;
    let bestScore = -1;

    for (const node of nearbyNodes) {
      const score = node.coverScore ?? 0;
      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }

    if (!bestNode) return null;
    return { x: bestNode.pos[0], y: bestNode.pos[1] };
  }

  /**
   * Get all chokepoint positions
   */
  getChokepoints(): Point[] {
    if (!this.navMesh) return [];

    const chokepoints: Point[] = [];

    for (const node of this.navMesh.nodes.values()) {
      if (node.isChokepoint) {
        chokepoints.push({ x: node.pos[0], y: node.pos[1] });
      }
    }

    return chokepoints;
  }

  /**
   * Distance between two nodes
   */
  private distance(a: NavNode, b: NavNode): number {
    const dx = a.pos[0] - b.pos[0];
    const dy = a.pos[1] - b.pos[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Heuristic for A* (Euclidean distance)
   */
  private heuristic(a: NavNode, b: NavNode): number {
    return this.distance(a, b);
  }

  /**
   * Get the navigation mesh (for debugging/visualization)
   */
  getNavMesh(): NavMesh | null {
    return this.navMesh;
  }

  /**
   * Check if nav mesh is loaded
   */
  isNavMeshLoaded(): boolean {
    return this.isLoaded;
  }
}

// Export singleton instance
export const enhancedNavMeshManager = EnhancedNavMeshManager.getInstance();
