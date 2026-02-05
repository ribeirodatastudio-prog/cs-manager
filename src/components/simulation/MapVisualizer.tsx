import React from "react";
import { GameMap } from "@/lib/engine/GameMap";
import { Bot } from "@/lib/engine/Bot";

interface MapVisualizerProps {
  map: GameMap;
  bots: Bot[];
  selectedBotId?: string | null;
}

export const MapVisualizer: React.FC<MapVisualizerProps> = ({ map, bots, selectedBotId }) => {
  const zones = map.getAllZones();

  // Draw connections (Edges)
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

  // Draw Path for Selected Bot
  const pathLines: React.ReactNode[] = [];
  if (selectedBotId) {
    const selectedBot = bots.find(b => b.id === selectedBotId);
    if (selectedBot && selectedBot.path && selectedBot.path.length > 0) {
      // Draw line from current position to first path node
      // Then from node to node

      const fullPathIds = [selectedBot.currentZoneId, ...selectedBot.path];

      for (let i = 0; i < fullPathIds.length - 1; i++) {
        const z1 = map.getZone(fullPathIds[i]);
        const z2 = map.getZone(fullPathIds[i+1]);
        if (z1 && z2) {
          pathLines.push(
            <line
              key={`path-${selectedBot.id}-${i}`}
              x1={z1.x}
              y1={z1.y}
              x2={z2.x}
              y2={z2.y}
              stroke={selectedBot.side === "T" ? "#eab308" : "#3b82f6"} // yellow-500 or blue-500
              strokeWidth="4"
              strokeDasharray="10,5"
              className="opacity-80"
            />
          );
        }
      }
    }
  }

  return (
    <div className="w-full h-full bg-zinc-900 border border-zinc-700 p-4 relative overflow-hidden rounded-none flex items-center justify-center">
      <svg viewBox="0 0 1000 1200" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {/* Connections */}
        {connections}

        {/* Path Lines */}
        {pathLines}

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

          // Offset based on index to reduce overlapping
          const offsetX = (index % 3) * 15 - 7.5;
          const offsetY = Math.floor(index / 3) * 15 - 7.5;

          const isSelected = bot.id === selectedBotId;

          return (
            <g key={bot.id}>
              {/* Highlight Circle if selected */}
              {isSelected && (
                 <circle
                   cx={zone.x + offsetX}
                   cy={zone.y + offsetY}
                   r={18}
                   className="fill-none stroke-white"
                   strokeWidth="3"
                 />
              )}

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
