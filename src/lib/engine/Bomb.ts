export enum BombStatus {
  IDLE = "IDLE", // Carried by T or dropped
  PLANTING = "PLANTING", // Being planted
  PLANTED = "PLANTED", // Countdown active
  DEFUSING = "DEFUSING", // Being defused
  DETONATED = "DETONATED", // Boom
  DEFUSED = "DEFUSED" // CT Win
}

export class Bomb {
  public status: BombStatus = BombStatus.IDLE;
  public timer: number = 0; // Ticks remaining for explosion
  public plantProgress: number = 0; // Ticks planted
  public defuseProgress: number = 0; // Ticks defused

  public carrierId?: string;
  public plantSite?: string;
  public planterId?: string;
  public defuserId?: string;
  public droppedLocation?: string; // Zone ID if dropped

  // Constants (Ticks - 100ms per tick)
  public readonly TICKS_PLANT = 35; // 3.5s * 10
  public readonly TICKS_DEFUSE_KIT = 50; // 5s * 10
  public readonly TICKS_DEFUSE_NO_KIT = 100; // 10s * 10
  public readonly TICKS_EXPLOSION = 400; // 40s * 10

  constructor() {
    this.reset();
  }

  reset() {
    this.status = BombStatus.IDLE;
    this.timer = this.TICKS_EXPLOSION;
    this.plantProgress = 0;
    this.defuseProgress = 0;
    this.carrierId = undefined;
    this.plantSite = undefined;
    this.planterId = undefined;
    this.defuserId = undefined;
    this.droppedLocation = undefined;
  }

  // Called every tick by MatchSimulator
  tick() {
      if (this.status === BombStatus.PLANTED || this.status === BombStatus.DEFUSING) {
          this.timer--;
          if (this.timer <= 0) {
              this.status = BombStatus.DETONATED;
          }
      }
  }

  startPlanting(botId: string, siteId: string): boolean {
      if (this.status !== BombStatus.IDLE) return false;
      this.status = BombStatus.PLANTING;
      this.planterId = botId;
      this.plantSite = siteId;
      return true;
  }

  updatePlanting(): boolean {
      if (this.status !== BombStatus.PLANTING) return false;
      this.plantProgress++;
      if (this.plantProgress >= this.TICKS_PLANT) {
          this.status = BombStatus.PLANTED;
          this.timer = this.TICKS_EXPLOSION;
          return true; // Planted
      }
      return false; // Still planting
  }

  abortPlanting() {
      if (this.status === BombStatus.PLANTING) {
          this.status = BombStatus.IDLE;
          this.plantProgress = 0;
          // Planter keeps the bomb
          this.planterId = undefined;
      }
  }

  startDefusing(botId: string): boolean {
      if (this.status !== BombStatus.PLANTED) return false;
      this.status = BombStatus.DEFUSING;
      this.defuserId = botId;
      return true;
  }

  updateDefusing(hasKit: boolean): boolean {
      if (this.status !== BombStatus.DEFUSING) return false;
      this.defuseProgress++;
      const required = hasKit ? this.TICKS_DEFUSE_KIT : this.TICKS_DEFUSE_NO_KIT;
      if (this.defuseProgress >= required) {
          this.status = BombStatus.DEFUSED;
          return true; // Defused
      }
      return false;
  }

  abortDefusing() {
      if (this.status === BombStatus.DEFUSING) {
          this.status = BombStatus.PLANTED;
          this.defuseProgress = 0;
          this.defuserId = undefined;
      }
  }

  drop(zoneId: string) {
      this.carrierId = undefined;
      this.droppedLocation = zoneId;
      this.status = BombStatus.IDLE;
      // Also abort planting if dropping (shouldn't happen simultaneously but for safety)
      this.plantProgress = 0;
      this.planterId = undefined;
  }

  pickup(botId: string) {
      this.carrierId = botId;
      this.droppedLocation = undefined;
      this.status = BombStatus.IDLE;
  }
}
