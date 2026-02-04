import { MapData, Zone } from "./types";

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
      .map((connId) => this.getZone(connId))
      .filter((z): z is Zone => z !== undefined);
  }

  getAllZones(): Zone[] {
    return Array.from(this.zones.values());
  }

  getSpawnPoint(side: "CT" | "T"): Zone | undefined {
    const spawnId = side === "CT" ? this.data.spawnPoints.CT : this.data.spawnPoints.T;
    return this.getZone(spawnId);
  }
}
