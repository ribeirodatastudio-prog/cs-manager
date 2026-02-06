import React, { useRef, useEffect } from "react";
import { NAV_MESH } from "@/lib/utils/navMesh";
import { MapData } from "@/lib/engine/types";

interface MapDebugViewerProps {
  mapData: MapData;
}

export const MapDebugViewer: React.FC<MapDebugViewerProps> = ({ mapData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas logical size to match our coordinate system (1024x1024)
    canvas.width = 1024;
    canvas.height = 1024;

    const mapImage = new Image();
    mapImage.src = "/dust2_2d.png";

    // Handle image loading
    mapImage.onload = () => {
      // 1. Draw Map Image
      // Stretch to fit the canvas, assuming the mesh bounds map to this area
      ctx.drawImage(mapImage, 0, 0, canvas.width, canvas.height);

      // 2. Draw Navigation Mesh
      // Set styles for mesh
      ctx.lineWidth = 1;

      Object.entries(NAV_MESH).forEach(([id, node]) => {
        // Use coordinates directly (they are pre-transformed to 0-1000 space)
        const sx = node.pos[0];
        const sy = node.pos[1];

        // Draw Connections (Edges)
        node.adj.forEach(adjId => {
          const adjNode = NAV_MESH[adjId.toString()];
          if (adjNode) {
            const ex = adjNode.pos[0];
            const ey = adjNode.pos[1];

            ctx.strokeStyle = "rgba(0, 255, 255, 0.3)";
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(ex, ey);
            ctx.stroke();
          }
        });

        // Draw Node (Walkable Area Center)
        ctx.fillStyle = "rgba(0, 255, 255, 0.6)";
        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      // 3. Draw Logical Zones (for verification)
      // These coordinates are already in SVG/Canvas space (0-1000)
      if (mapData && mapData.zones) {
        ctx.strokeStyle = "rgba(255, 50, 50, 0.8)";
        ctx.fillStyle = "rgba(255, 50, 50, 0.8)";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        mapData.zones.forEach(zone => {
          // Draw Zone Point
          ctx.beginPath();
          ctx.arc(zone.x, zone.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Draw Zone Name
          ctx.fillStyle = "white";
          ctx.fillText(zone.name, zone.x, zone.y - 10);
          ctx.fillStyle = "rgba(255, 50, 50, 0.8)"; // Reset fill
        });
      }
    };
  }, [mapData]);

  return (
    <div className="w-full h-full bg-zinc-900 border border-zinc-700 relative flex items-center justify-center overflow-hidden">
      <canvas
        ref={canvasRef}
        className="max-w-full max-h-full object-contain"
        style={{ aspectRatio: "1/1" }}
      />
    </div>
  );
};
