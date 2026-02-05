export type EventType = "ENEMY_SPOTTED" | "TEAMMATE_DIED";

export interface EnemySpottedEvent {
  type: "ENEMY_SPOTTED";
  zoneId: string;
  timestamp: number;
  enemyCount: number;
  spottedBy: string; // Bot ID
}

export interface TeammateDiedEvent {
  type: "TEAMMATE_DIED";
  zoneId: string;
  timestamp: number;
  victimId: string;
  killerId?: string;
}

export type GameEvent = EnemySpottedEvent | TeammateDiedEvent;

export type EventHandler = (event: GameEvent) => void;

export class EventManager {
  private listeners: Map<EventType, EventHandler[]> = new Map();

  subscribe(type: EventType, handler: EventHandler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(handler);
  }

  unsubscribe(type: EventType, handler: EventHandler) {
    const handlers = this.listeners.get(type);
    if (handlers) {
      this.listeners.set(type, handlers.filter(h => h !== handler));
    }
  }

  publish(event: GameEvent) {
    const handlers = this.listeners.get(event.type);
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }
  }
}
