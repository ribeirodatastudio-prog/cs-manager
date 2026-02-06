import { MapData, Zone, Connection, Point } from "./types";
import { navMeshManager } from "./NavMeshManager";

// Defined by the standardized SVG/Canvas coordinate system (0-1000)
const MAP_WIDTH = 1000;
const MAP_HEIGHT = 1000;

export class GameMap {
  private zones: Map<string, Zone>;
  public readonly data: MapData;

  constructor(data: MapData) {
    this.data = data;
    this.zones = new Map();
    data.zones.forEach((zone) => {
      this.zones.set(zone.id, zone);
    });

    // Ensure nav mesh starts loading if not already
    if (!navMeshManager.isNavMeshLoaded()) {
        navMeshManager.loadNavMesh().catch(err => console.error("NavMesh auto-load failed:", err));
    }
  }

  getZone(id: string): Zone | undefined {
    return this.zones.get(id);
  }

  // Strategic Neighbors (from graph data)
  getNeighbors(zoneId: string): Zone[] {
    const zone = this.getZone(zoneId);
    if (!zone) return [];

    return zone.connections
      .map((conn) => this.getZone(conn.to))
      .filter((z): z is Zone => z !== undefined);
  }

  getConnections(zoneId: string): Connection[] {
      const zone = this.getZone(zoneId);
      if (!zone) return [];
      return zone.connections;
  }

  getAllZones(): Zone[] {
    return Array.from(this.zones.values());
  }

  getSpawnPoint(side: "CT" | "T"): Zone | undefined {
    const spawnId = side === "CT" ? this.data.spawnPoints.CT : this.data.spawnPoints.T;
    return this.getZone(spawnId);
  }

  // Euclidean Distance between two zones (centroids)
  getDistance(zoneId1: string, zoneId2: string): number {
    const z1 = this.getZone(zoneId1);
    const z2 = this.getZone(zoneId2);
    if (!z1 || !z2) return Infinity;
    return this.getPointDistance(z1, z2);
  }

  getPointDistance(p1: Point, p2: Point): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // --- Pathfinding & Collision ---

  isWalkable(x: number, y: number): boolean {
    return navMeshManager.isWalkable({ x, y });
  }

  findPath(start: Point, end: Point): Point[] {
    return navMeshManager.findPath(start, end);
  }

  // Find nearest valid walkable point (if spawned in wall)
  getNearestWalkable(p: Point, radius: number = 50): Point {
      if (this.isWalkable(p.x, p.y)) return p;

      // Spiral search
      for (let r = 5; r <= radius; r += 5) {
          for (let angle = 0; angle < 360; angle += 45) {
              const rad = angle * (Math.PI / 180);
              const testX = p.x + Math.cos(rad) * r;
              const testY = p.y + Math.sin(rad) * r;
              if (this.isWalkable(testX, testY)) {
                  return { x: testX, y: testY };
              }
          }
      }
      return p; // Failed
  }

  // Helper to find which zone a point is technically "in"
  // Simple nearest neighbor to zone centroid
  getZoneAt(p: Point): Zone | undefined {
      let closest: Zone | undefined;
      let minDst = Infinity;

      for (const zone of this.zones.values()) {
          const dst = this.getPointDistance(p, zone);
          // Optimization: Check if within reasonable range (e.g. 200 units)
          if (dst < minDst) {
              minDst = dst;
              closest = zone;
          }
      }
      return closest;
  }
}
