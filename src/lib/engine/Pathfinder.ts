import { NAV_MESH, NavMeshNode } from "@/lib/utils/navMesh";
import { Point } from "./types";

export class Pathfinder {
  private static nodes = Object.entries(NAV_MESH).map(([id, node]) => ({
    id: parseInt(id),
    pos: node.pos,
    adj: node.adj
  }));

  private static getClosestNode(p: Point): { id: number; pos: [number, number]; distSq: number } | null {
    let closest = null;
    let minDistSq = Infinity;

    for (const node of this.nodes) {
      const dx = p.x - node.pos[0];
      const dy = p.y - node.pos[1];
      const distSq = dx * dx + dy * dy;

      if (distSq < minDistSq) {
        minDistSq = distSq;
        closest = { id: node.id, pos: node.pos, distSq };
      }
    }
    return closest;
  }

  static isWalkable(x: number, y: number): boolean {
    const WALKABLE_THRESHOLD = 50;
    const thresholdSq = WALKABLE_THRESHOLD * WALKABLE_THRESHOLD;

    // We can iterate purely for distance check
    let minDistSq = Infinity;
    for (const node of this.nodes) {
      const dx = x - node.pos[0];
      const dy = y - node.pos[1];
      const distSq = dx * dx + dy * dy;

      if (distSq < minDistSq) {
        minDistSq = distSq;
      }

      // Early exit if we found a node close enough
      if (minDistSq < thresholdSq) return true;
    }

    return minDistSq < thresholdSq;
  }

  static hasLineOfSight(start: Point, end: Point): boolean {
    const dist = this.heuristic([start.x, start.y], [end.x, end.y]);
    const stepSize = 20; // Check every 20 units
    const steps = Math.ceil(dist / stepSize);

    const dx = (end.x - start.x) / steps;
    const dy = (end.y - start.y) / steps;

    // Sample points along the ray
    for (let i = 1; i < steps; i++) {
        const cx = start.x + dx * i;
        const cy = start.y + dy * i;
        if (!this.isWalkable(cx, cy)) {
            return false;
        }
    }
    return true;
  }

  static findPath(start: Point, end: Point): Point[] {
    const startNodeInfo = this.getClosestNode(start);
    const endNodeInfo = this.getClosestNode(end);

    if (!startNodeInfo || !endNodeInfo) return [];

    // A* Algorithm
    const startId = startNodeInfo.id;
    const endId = endNodeInfo.id;

    if (startId === endId) {
        return [end];
    }

    const openSet = new Set<number>([startId]);
    const cameFrom = new Map<number, number>(); // node -> parent

    const gScore = new Map<number, number>();
    gScore.set(startId, 0);

    const fScore = new Map<number, number>();
    fScore.set(startId, this.heuristic(startNodeInfo.pos, endNodeInfo.pos));

    // Helper to get node by ID
    // Since we pre-processed nodes into an array, we might want a map for O(1) lookup
    // or just rely on NAV_MESH global object for lookup by string ID
    const getNode = (id: number) => NAV_MESH[id.toString()];

    while (openSet.size > 0) {
        // Find node in openSet with lowest fScore
        let currentId = -1;
        let lowestF = Infinity;

        for (const id of openSet) {
            const f = fScore.get(id) ?? Infinity;
            if (f < lowestF) {
                lowestF = f;
                currentId = id;
            }
        }

        if (currentId === endId) {
            return this.reconstructPath(cameFrom, currentId, end);
        }

        openSet.delete(currentId);
        const currentNode = getNode(currentId);
        if (!currentNode) continue;

        for (const neighborId of currentNode.adj) {
            const neighborNode = getNode(neighborId);
            if (!neighborNode) continue;

            const dist = this.heuristic(currentNode.pos, neighborNode.pos);
            const tentativeG = (gScore.get(currentId) ?? Infinity) + dist;

            if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
                cameFrom.set(neighborId, currentId);
                gScore.set(neighborId, tentativeG);
                fScore.set(neighborId, tentativeG + this.heuristic(neighborNode.pos, endNodeInfo.pos));

                if (!openSet.has(neighborId)) {
                    openSet.add(neighborId);
                }
            }
        }
    }

    // No path found
    return [];
  }

  private static heuristic(posA: [number, number], posB: [number, number]): number {
      const dx = posA[0] - posB[0];
      const dy = posA[1] - posB[1];
      return Math.sqrt(dx * dx + dy * dy);
  }

  private static reconstructPath(cameFrom: Map<number, number>, currentId: number, endTarget: Point): Point[] {
      const path: Point[] = [];

      // We don't necessarily add the exact mesh node coordinates if we want smooth movement,
      // but for A* path it's usually nodes.
      // We add the final target point at the end.
      path.push(endTarget);

      let curr = currentId;
      while (cameFrom.has(curr)) {
          const node = NAV_MESH[curr.toString()];
          if (node) {
              path.unshift({ x: node.pos[0], y: node.pos[1] });
          }
          curr = cameFrom.get(curr)!;
      }

      // Note: We intentionally don't add the start node itself if the bot is already near it,
      // but standard path reconstruction usually includes it.
      // However, Bot.move typically consumes the path.

      return path;
  }
}
