import React from "react";
import { GameMap } from "@/lib/engine/GameMap";
import { Bot } from "@/lib/engine/Bot";
import { ZoneState } from "@/lib/engine/MatchSimulator";

interface MapVisualizerProps {
  map: GameMap;
  bots: Bot[];
  zoneStates?: Record<string, ZoneState>; // Optional to support legacy usages
  selectedBotId?: string | null;
}

export const MapVisualizer: React.FC<MapVisualizerProps> = ({ map, bots, zoneStates, selectedBotId }) => {
  const zones = map.getAllZones();

  // Collect Dropped Weapons
  const droppedWeaponsNodes: React.ReactNode[] = [];
  if (zoneStates) {
      Object.values(zoneStates).forEach(state => {
          state.droppedWeapons.forEach(drop => {
              droppedWeaponsNodes.push(
                  <g key={drop.id} className="pointer-events-none">
                      <rect
                        x={drop.x - 3}
                        y={drop.y - 3}
                        width={6}
                        height={6}
                        transform={`rotate(45 ${drop.x} ${drop.y})`}
                        className="fill-purple-500 stroke-black stroke-[0.5]"
                      />
                  </g>
              );
          });
      });
  }

  // Draw connections (Edges)
  const drawnConnections = new Set<string>();
  const connections: React.ReactNode[] = [];

  zones.forEach((zone) => {
    zone.connections.forEach((connection) => {
      const target = map.getZone(connection.to);
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

  // Draw Cones of Vision
  const cones: React.ReactNode[] = [];
  bots.forEach((bot, index) => {
      if (bot.status === "DEAD") return;
      // Only draw if selected or maybe for all? Requirement implies visualizer shows focus area.
      // Let's show for all but maybe fainter for non-selected.

      const zone = map.getZone(bot.currentZoneId);
      if (!zone) return;

      const offsetX = (index % 3) * 15 - 7.5;
      const offsetY = Math.floor(index / 3) * 15 - 7.5;
      const startX = zone.x + offsetX;
      const startY = zone.y + offsetY;

      let targetX = startX;
      let targetY = startY;

      if (bot.focusZoneId) {
          const targetZone = map.getZone(bot.focusZoneId);
          if (targetZone) {
              targetX = targetZone.x;
              targetY = targetZone.y;
          }
      } else if (bot.goalZoneId && bot.goalZoneId !== bot.currentZoneId) {
           const targetZone = map.getZone(bot.goalZoneId);
           if (targetZone) {
               targetX = targetZone.x;
               targetY = targetZone.y;
           }
      }

      if (targetX !== startX || targetY !== startY) {
          const angle = Math.atan2(targetY - startY, targetX - startX);
          const length = 100; // Visual length
          const width = Math.PI / 4; // 45 degrees

          const leftAngle = angle - width / 2;
          const rightAngle = angle + width / 2;

          const x1 = startX + length * Math.cos(leftAngle);
          const y1 = startY + length * Math.sin(leftAngle);
          const x2 = startX + length * Math.cos(rightAngle);
          const y2 = startY + length * Math.sin(rightAngle);

          const isSelected = bot.id === selectedBotId;
          const color = bot.side === "T" ? "fill-yellow-500" : "fill-blue-500";
          const opacity = isSelected ? "opacity-30" : "opacity-10";

          // Path for sector
          const d = `M ${startX} ${startY} L ${x1} ${y1} A ${length} ${length} 0 0 1 ${x2} ${y2} Z`;

          cones.push(
              <path
                  key={`cone-${bot.id}`}
                  d={d}
                  className={`${color} ${opacity} pointer-events-none`}
              />
          );
      }
  });

  return (
    <div className="w-full h-full bg-zinc-900 border border-zinc-700 p-4 relative overflow-hidden rounded-none flex items-center justify-center">
      <svg viewBox="0 0 1000 1200" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        {/* Connections */}
        {connections}

        {/* Path Lines */}
        {pathLines}

        {/* Vision Cones */}
        {cones}

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

        {/* Dropped Weapons */}
        {droppedWeaponsNodes}

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
