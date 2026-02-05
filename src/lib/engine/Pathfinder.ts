import { GameMap } from "./GameMap";
import { Zone } from "./types";

interface QueueNode {
  zoneId: string;
  priority: number;
}

export class Pathfinder {
  /**
   * Finds the shortest path (fewest hops) between startZoneId and endZoneId.
   * @param prioritizeCover If true, adds penalty for zones with low cover to encourage safe routes.
   */
  static findPath(map: GameMap, startZoneId: string, endZoneId: string, prioritizeCover: boolean = false): string[] | null {
    if (startZoneId === endZoneId) return [startZoneId];

    const startZone = map.getZone(startZoneId);
    const endZone = map.getZone(endZoneId);

    if (!startZone || !endZone) return null;

    const frontier: QueueNode[] = [{ zoneId: startZoneId, priority: 0 }];
    const cameFrom: Record<string, string | null> = {};
    const costSoFar: Record<string, number> = {};

    cameFrom[startZoneId] = null;
    costSoFar[startZoneId] = 0;

    while (frontier.length > 0) {
      // Sort descending and pop (simple priority queue)
      // Note: For A*, we want lowest priority value (cost + heuristic).
      // Here priority represents cost. We pop the lowest cost.
      frontier.sort((a, b) => b.priority - a.priority);
      const current = frontier.pop()!;

      if (current.zoneId === endZoneId) {
        break;
      }

      const neighbors = map.getNeighbors(current.zoneId);
      for (const next of neighbors) {
        // Base cost is 1 (hop).
        // If prioritizeCover, add penalty for low cover.
        // Penalty: (1 - cover) * 5.  (Cover 0.0 -> +5 cost. Cover 1.0 -> +0 cost).
        // Heavily penalize open areas.
        const stepCost = 1 + (prioritizeCover ? (1 - (next.cover || 0)) * 5 : 0);

        const newCost = costSoFar[current.zoneId] + stepCost;

        if (!(next.id in costSoFar) || newCost < costSoFar[next.id]) {
          costSoFar[next.id] = newCost;
          // Heuristic: Euclidean distance / 100 (rough scale) to guide it, or just 0 for Dijkstra
          // Let's use 0 for now to guarantee shortest hop path (or safest path)
          const priority = newCost;
          frontier.push({ zoneId: next.id, priority });
          cameFrom[next.id] = current.zoneId;
        }
      }
    }

    if (!(endZoneId in cameFrom)) {
      return null; // No path found
    }

    // Reconstruct path
    const path: string[] = [];
    let curr: string | null = endZoneId;
    while (curr !== null) {
      path.push(curr);
      curr = cameFrom[curr];
    }

    return path.reverse();
  }

  /**
   * Finds the zone furthest from the startZoneId (in terms of hops).
   * Used for "Save" logic.
   */
  static findFurthestZone(map: GameMap, startZoneId: string): string | null {
    const startZone = map.getZone(startZoneId);
    if (!startZone) return null;

    const queue: { id: string; dist: number }[] = [{ id: startZoneId, dist: 0 }];
    const visited = new Set<string>([startZoneId]);

    let furthestZoneId = startZoneId;
    let maxDist = 0;

    while (queue.length > 0) {
      const { id, dist } = queue.shift()!;

      if (dist > maxDist) {
        maxDist = dist;
        furthestZoneId = id;
      }

      const neighbors = map.getNeighbors(id);
      for (const next of neighbors) {
        if (!visited.has(next.id)) {
          visited.add(next.id);
          queue.push({ id: next.id, dist: dist + 1 });
        }
      }
    }

    return furthestZoneId;
  }
}
