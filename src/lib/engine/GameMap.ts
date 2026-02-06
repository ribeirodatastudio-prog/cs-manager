import { MapData, Zone, Connection } from "./types";

export class GameMap {
  private zones: Map<string, Zone>;
  public readonly data: MapData;

  constructor(data: MapData) {
    this.data = data;
    this.zones = new Map();
    data.zones.forEach((zone) => {
      this.zones.set(zone.id, zone);
    });
  }

  getZone(id: string): Zone | undefined {
    return this.zones.get(id);
  }

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

  getDistance(zoneId1: string, zoneId2: string): number {
    const z1 = this.getZone(zoneId1);
    const z2 = this.getZone(zoneId2);

    if (!z1 || !z2) return Infinity;

    const dx = z1.x - z2.x;
    const dy = z1.y - z2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
