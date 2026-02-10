import React, { useRef, useEffect, useState } from "react";
import { enhancedNavMeshManager, NavNode } from "@/lib/engine/EnhancedNavMeshManager";

export const NavMeshVisualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showVision, setShowVision] = useState(false);
  const [showCover, setShowCover] = useState(true);
  const [showEdges, setShowEdges] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    // Trigger load if not loaded
    if (!enhancedNavMeshManager.isNavMeshLoaded()) {
        enhancedNavMeshManager.loadNavMesh().catch(console.error);
    }

    // Check if loaded
    const checkLoaded = setInterval(() => {
      if (enhancedNavMeshManager.isNavMeshLoaded()) {
        setIsLoaded(true);
        clearInterval(checkLoaded);
      }
    }, 500);
    return () => clearInterval(checkLoaded);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
        // clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw background map
        const img = new Image();
        img.src = "/dust2_2d.png";

        const renderMesh = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            drawNavMesh(ctx);
        };

        if (img.complete) {
            renderMesh();
        } else {
            img.onload = renderMesh;
        }
    };

    draw();

  }, [isLoaded, showVision, showCover, showEdges, selectedNodeId]);

  const drawNavMesh = (ctx: CanvasRenderingContext2D) => {
    const navMesh = enhancedNavMeshManager.getNavMesh();
    if (!navMesh) return;

    // Draw edges first (background)
    if (showEdges) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        navMesh.nodes.forEach(node => {
            node.adj.forEach(adjId => {
                const adj = navMesh.nodes.get(adjId.toString());
                if (adj) {
                    ctx.moveTo(node.pos[0], node.pos[1]);
                    ctx.lineTo(adj.pos[0], adj.pos[1]);
                }
            });
        });
        ctx.stroke();
    }

    // Draw nodes
    navMesh.nodes.forEach(node => {
       if (showCover) {
           const score = node.coverScore || 0;
           // Color from Red (0) to Green (1)
           // score 0 -> red (255, 0, 0)
           // score 1 -> green (0, 255, 0)
           ctx.fillStyle = `rgb(${Math.floor(255 * (1-score))}, ${Math.floor(255 * score)}, 0)`;
       } else {
           ctx.fillStyle = "cyan";
       }

       if (node.id === selectedNodeId) {
           ctx.fillStyle = "white";
           ctx.strokeStyle = "yellow";
           ctx.lineWidth = 2;
           ctx.beginPath();
           ctx.arc(node.pos[0], node.pos[1], 5, 0, Math.PI * 2);
           ctx.fill();
           ctx.stroke();
       } else {
           ctx.beginPath();
           ctx.arc(node.pos[0], node.pos[1], 2, 0, Math.PI * 2);
           ctx.fill();
       }

       // Draw Vision for selected node
       if ((showVision && !selectedNodeId) || (selectedNodeId === node.id && node.visibleNodes)) {
           // If vision enabled globally (heavy!) or for selected node
           if (selectedNodeId === node.id || showVision) {
                ctx.strokeStyle = selectedNodeId === node.id ? "rgba(0, 255, 0, 0.3)" : "rgba(0, 255, 0, 0.02)";
                ctx.beginPath();
                node.visibleNodes?.forEach(visId => {
                    const vis = navMesh.nodes.get(visId);
                    if (vis) {
                        ctx.moveTo(node.pos[0], node.pos[1]);
                        ctx.lineTo(vis.pos[0], vis.pos[1]);
                    }
                });
                ctx.stroke();
           }
       }
    });
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      const node = enhancedNavMeshManager.getClosestNode({ x, y });
      if (node) {
          setSelectedNodeId(node.id === selectedNodeId ? null : node.id);
      }
  };

  return (
    <div className="relative w-full h-full bg-zinc-900 border border-zinc-700 flex items-center justify-center overflow-hidden">
      {!isLoaded && <div className="absolute text-white">Loading NavMesh...</div>}
      <canvas
        ref={canvasRef}
        width={1024}
        height={1024}
        className="max-w-full max-h-full object-contain cursor-crosshair"
        style={{ aspectRatio: "1/1" }}
        onClick={handleClick}
      />
      <div className="absolute top-4 left-4 bg-black/80 p-4 rounded text-white text-xs z-10">
        <h3 className="font-bold mb-2">NavMesh Debug</h3>
        <label className="block mb-1 cursor-pointer">
            <input type="checkbox" checked={showEdges} onChange={e => setShowEdges(e.target.checked)} className="mr-2"/> Show Edges
        </label>
        <label className="block mb-1 cursor-pointer">
            <input type="checkbox" checked={showCover} onChange={e => setShowCover(e.target.checked)} className="mr-2"/> Show Cover Scores
        </label>
        <label className="block mb-1 cursor-pointer">
            <input type="checkbox" checked={showVision} onChange={e => setShowVision(e.target.checked)} className="mr-2"/> Show All Vision (Warning: Slow/Cluttered)
        </label>
        <div className="mt-2 text-gray-400">
            Click a node to see its specific vision lines.
            {selectedNodeId && <div className="text-yellow-400 mt-1">Selected: {selectedNodeId}</div>}
        </div>
      </div>
    </div>
  );
};
