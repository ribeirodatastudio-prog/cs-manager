/**
 * Navigation Mesh Manager for CS2 Dust 2
 * Loads and manages the navigation mesh from de_dust2_web.json
 */
import { Point } from "./types";

export interface NavNode {
  id: string;
  pos: [number, number];
  adj: number[];
}

export interface NavMesh {
  nodes: Map<string, NavNode>;
  adjacencyMap: Map<string, Set<string>>;
}

/**
 * Manages the navigation mesh for pathfinding and movement
 */
export class NavMeshManager {
  private static instance: NavMeshManager;
  private navMesh: NavMesh | null = null;
  private isLoaded = false;

  private constructor() {}

  static getInstance(): NavMeshManager {
    if (!NavMeshManager.instance) {
      NavMeshManager.instance = new NavMeshManager();
    }
    return NavMeshManager.instance;
  }

  /**
   * Load the navigation mesh from JSON
   */
  async loadNavMesh(navData?: Record<string, { pos: [number, number]; adj: number[] }>): Promise<void> {
    try {
      let data = navData;

      if (!data) {
        // Load from public folder if not provided
        const response = await fetch('/de_dust2_web.json');
        if (!response.ok) {
          throw new Error('Failed to load navigation mesh');
        }
        data = await response.json();
      }

      if (!data) throw new Error("No nav data found");

      const nodes = new Map<string, NavNode>();
      const adjacencyMap = new Map<string, Set<string>>();

      // Parse the navigation data
      for (const [id, nodeData] of Object.entries(data)) {
        const node: NavNode = {
          id,
          pos: nodeData.pos,
          adj: nodeData.adj
        };

        nodes.set(id, node);

        // Build adjacency map for quick lookup
        const adjSet = new Set<string>();
        nodeData.adj.forEach(adjId => adjSet.add(adjId.toString()));
        adjacencyMap.set(id, adjSet);
      }

      this.navMesh = { nodes, adjacencyMap };
      this.isLoaded = true;

      console.log(`Navigation mesh loaded: ${nodes.size} nodes`);
    } catch (error) {
      console.error('Failed to load navigation mesh:', error);
      throw error;
    }
  }

  /**
   * Get the closest navigation node to a point
   */
  getClosestNode(point: Point): NavNode | null {
    if (!this.navMesh) return null;
    let closestNode: NavNode | null = null;
    let minDistance = Infinity;

    for (const node of this.navMesh.nodes.values()) {
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
   * Check if a position is walkable (near a nav node)
   */
  isWalkable(point: Point, threshold = 30): boolean {
    const closestNode = this.getClosestNode(point);
    if (!closestNode) return false;
    const dx = closestNode.pos[0] - point.x;
    const dy = closestNode.pos[1] - point.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance <= threshold;
  }

  /**
   * Find path between two points using nav mesh (A* algorithm)
   */
  findPath(start: Point, end: Point): Point[] {
    if (!this.navMesh) return [];
    const startNode = this.getClosestNode(start);
    const endNode = this.getClosestNode(end);

    if (!startNode || !endNode) return [];
    if (startNode.id === endNode.id) return [end];

    // A* pathfinding on the nav mesh
    const openSet = new Set<string>();
    openSet.add(startNode.id);
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();

    gScore.set(startNode.id, 0);
    fScore.set(startNode.id, this.heuristic(startNode, endNode));

    while (openSet.size > 0) {
      // Find node in openSet with lowest fScore
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

      // Check all adjacent nodes
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

    // No path found
    return [];
  }

  /**
   * Reconstruct the path from A* result
   */
  private reconstructPath( cameFrom: Map<string, string>, current: string, start: Point, end: Point ): Point[] {
    if (!this.navMesh) return [];
    const path: Point[] = [end];

    while (cameFrom.has(current)) {
      const node = this.navMesh.nodes.get(current);
      if (!node) break;

      path.unshift({ x: node.pos[0], y: node.pos[1] });
      current = cameFrom.get(current)!;
    }

    // Add start point
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

      // Find the farthest point we can reach directly
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
   * Check if there's line of sight between two points
   */
  private hasLineOfSight(start: Point, end: Point): boolean {
    const steps = 20;
    const dx = (end.x - start.x) / steps;
    const dy = (end.y - start.y) / steps;
    for (let i = 0; i <= steps; i++) {
      const x = start.x + dx * i;
      const y = start.y + dy * i;

      if (!this.isWalkable({ x, y }, 20)) {
        return false;
      }
    }

    return true;
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
   * Get all nodes within a radius
   */
  getNodesInRadius(center: Point, radius: number): NavNode[] {
    if (!this.navMesh) return [];
    const nodes: NavNode[] = [];

    for (const node of this.navMesh.nodes.values()) {
      const dx = node.pos[0] - center.x;
      const dy = node.pos[1] - center.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= radius) {
        nodes.push(node);
      }
    }

    return nodes;
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
export const navMeshManager = NavMeshManager.getInstance();
