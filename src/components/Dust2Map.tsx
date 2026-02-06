"use client";

import React, { useMemo, useState } from 'react';
import dust2DataRaw from '@/data/de_dust2_web.json';

// Type definition for the JSON data
type NodeId = string;
interface NodeData {
  pos: [number, number];
  adj: number[]; // The JSON has numbers in the adj array, even if keys are strings
}

const dust2Data = dust2DataRaw as Record<NodeId, NodeData>;

interface Dust2MapProps {
  className?: string;
}

export const Dust2Map: React.FC<Dust2MapProps> = ({ className }) => {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // 1. Calculate Bounding Box
  const { minX, minY, width, height } = useMemo(() => {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    Object.values(dust2Data).forEach((node) => {
      const [x, y] = node.pos;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    const padding = 100;
    return {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding,
      width: (maxX - minX) + (padding * 2),
      height: (maxY - minY) + (padding * 2),
    };
  }, []);

  // 2. Prepare Edges (unique set of connections)
  const edges = useMemo(() => {
    const uniqueEdges = new Set<string>();
    const edgeList: Array<{ x1: number, y1: number, x2: number, y2: number, id: string }> = [];

    Object.entries(dust2Data).forEach(([id, node]) => {
      const [x1, y1] = node.pos;
      node.adj.forEach((neighborIdNum) => {
        const neighborId = String(neighborIdNum);
        const neighbor = dust2Data[neighborId];

        if (neighbor) {
          const [x2, y2] = neighbor.pos;
          // Create a unique key for the edge (sorted ids) to avoid duplicates
          const edgeKey = [id, neighborId].sort().join('-');

          if (!uniqueEdges.has(edgeKey)) {
            uniqueEdges.add(edgeKey);
            edgeList.push({ x1, y1, x2, y2, id: edgeKey });
          }
        }
      });
    });

    return edgeList;
  }, []);

  // Helper to determine if a node is a neighbor of the hovered node
  const isNeighborOfHovered = (nodeId: string) => {
    if (!hoveredNodeId) return false;
    const hoveredNode = dust2Data[hoveredNodeId];
    return hoveredNode?.adj.some(adjId => String(adjId) === nodeId);
  };

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
       {/*
         The SVG viewBox matches the Game Units coordinate system.
         Note: SVG Y increases downwards, while Game Y usually increases upwards (North).
         This graph might appear vertically inverted compared to standard map overviews.
       */}
      <svg
        viewBox={`${minX} ${minY} ${width} ${height}`}
        className="w-full h-full block"
        preserveAspectRatio="xMidYMid meet"
        style={{ pointerEvents: 'all' }} // Ensure mouse events work
      >
        {/* Edges */}
        {edges.map((edge) => (
          <line
            key={edge.id}
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            stroke="white"
            strokeOpacity={0.3}
            strokeWidth={2} // Slightly thicker than 1px for visibility at this scale
            vectorEffect="non-scaling-stroke" // Keep line width constant regardless of zoom
          />
        ))}

        {/* Nodes */}
        {Object.entries(dust2Data).map(([id, node]) => {
          const [x, y] = node.pos;
          const isHovered = id === hoveredNodeId;
          const isNeighbor = isNeighborOfHovered(id);

          return (
            <circle
              key={id}
              cx={x}
              cy={y}
              r={isHovered ? 15 : (isNeighbor ? 10 : 6)}
              fill={isHovered ? "#ff00ff" : (isNeighbor ? "#00FFFF" : "#00FFFF")} // Magenta for hover, Cyan for others
              fillOpacity={isHovered || isNeighbor ? 1 : 0.8}
              stroke="black"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              onMouseEnter={() => {
                console.log(`Hovered Node ID: ${id}`);
                setHoveredNodeId(id);
              }}
              onMouseLeave={() => setHoveredNodeId(null)}
              style={{ cursor: 'crosshair', transition: 'r 0.2s, fill-opacity 0.2s' }}
            >
              <title>{`Node ${id}`}</title>
            </circle>
          );
        })}
      </svg>

      {/* Overlay info */}
      <div className="absolute top-4 left-4 bg-black/50 text-white p-2 rounded pointer-events-none">
        <p className="text-sm font-mono">
           Hovered: {hoveredNodeId || '-'}
        </p>
      </div>
    </div>
  );
};
