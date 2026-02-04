import { GameMap } from "./GameMap";
import { Zone } from "./types";

interface QueueNode {
  zoneId: string;
  priority: number;
}

export class Pathfinder {
  /**
   * Finds the shortest path (fewest hops) between startZoneId and endZoneId.
   */
  static findPath(map: GameMap, startZoneId: string, endZoneId: string): string[] | null {
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
      frontier.sort((a, b) => b.priority - a.priority);
      const current = frontier.pop()!;

      if (current.zoneId === endZoneId) {
        break;
      }

      const neighbors = map.getNeighbors(current.zoneId);
      for (const next of neighbors) {
        const newCost = costSoFar[current.zoneId] + 1; // Uniform cost for now (1 hop)

        if (!(next.id in costSoFar) || newCost < costSoFar[next.id]) {
          costSoFar[next.id] = newCost;
          // Heuristic: Euclidean distance / 100 (rough scale) to guide it, or just 0 for Dijkstra
          // Let's use 0 for now to guarantee shortest hop path
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
}
