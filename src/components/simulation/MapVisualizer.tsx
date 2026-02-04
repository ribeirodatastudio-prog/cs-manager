import React from "react";
import { GameMap } from "@/lib/engine/GameMap";
import { Bot } from "@/lib/engine/Bot";

interface MapVisualizerProps {
  map: GameMap;
  bots: Bot[];
}

export const MapVisualizer: React.FC<MapVisualizerProps> = ({ map, bots }) => {
  const zones = map.getAllZones();

  // Draw connections (Edges)
  // We need to avoid drawing duplicates. Set of "id-id".
  const drawnConnections = new Set<string>();

  const connections: React.ReactNode[] = [];
  zones.forEach((zone) => {
    zone.connections.forEach((targetId) => {
      const target = map.getZone(targetId);
      if (target) {
        const edgeId = [zone.id, target.id].sort().join("-");
        if (!drawnConnections.has(edgeId)) {
          drawnConnections.add(edgeId);
          connections.push(
            <line
              key={edgeId}
              x1={zone.x}
              y1={zone.y}
              x2={target.x}
              y2={target.y}
              stroke="#3f3f46" // zinc-700
              strokeWidth="2"
            />
          );
        }
      }
    });
  });

  return (
    <div className="w-full aspect-square bg-zinc-900 border border-zinc-700 p-4 relative overflow-hidden rounded-none">
      <svg viewBox="0 0 1000 1000" className="w-full h-full">
        {/* Connections */}
        {connections}

        {/* Zones */}
        {zones.map((zone) => (
          <g key={zone.id}>
            <circle
              cx={zone.x}
              cy={zone.y}
              r={15}
              className="fill-zinc-800 stroke-zinc-600"
              strokeWidth="2"
            />
            <text
              x={zone.x}
              y={zone.y + 30}
              textAnchor="middle"
              className="fill-zinc-400 text-[20px] font-mono select-none"
            >
              {zone.name}
            </text>
          </g>
        ))}

        {/* Bots */}
        {bots.map((bot, index) => {
          if (bot.status === "DEAD") return null;

          const zone = map.getZone(bot.currentZoneId);
          if (!zone) return null;

          // Offset based on bots in same zone?
          // Simple random jitter or deterministic offset based on index?
          // Let's just use index offset for now to separate them visually if stacked.
          // But bots list order might change? No, it's stable.
          // Count how many bots are here.
          // For simplicity, just add small random jitter or use a predictable offset based on bot.id hash?
          const offsetX = (index % 3) * 15 - 7.5;
          const offsetY = Math.floor(index / 3) * 15 - 7.5;

          return (
            <g key={bot.id}>
              <circle
                cx={zone.x + offsetX}
                cy={zone.y + offsetY}
                r={10}
                className={bot.side === "T" ? "fill-yellow-500" : "fill-blue-500"}
              />
              {/* HP Bar */}
              <rect
                x={zone.x + offsetX - 10}
                y={zone.y + offsetY - 15}
                width={20}
                height={4}
                className="fill-red-900"
              />
              <rect
                x={zone.x + offsetX - 10}
                y={zone.y + offsetY - 15}
                width={20 * (bot.hp / 100)}
                height={4}
                className="fill-green-500"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};
