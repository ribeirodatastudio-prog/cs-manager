"use client";

import React, { useState } from "react";
import { DUST2_MAP } from "@/lib/engine/maps/dust2";
import { MapDebugViewer } from "@/components/debug/MapDebugViewer";
import { NavMeshVisualizer } from "@/components/debug/NavMeshVisualizer";

export default function MapDebugPage() {
  const [view, setView] = useState<"classic" | "enhanced">("enhanced");

  return (
    <div className="w-screen h-screen bg-black flex flex-col">
      <div className="p-4 bg-zinc-800 text-white flex justify-between items-center">
        <h1 className="text-xl font-bold">Map Debug: Dust 2</h1>
        <div className="flex gap-4">
             <button
                className={`px-3 py-1 rounded ${view === "classic" ? "bg-blue-600" : "bg-zinc-700"}`}
                onClick={() => setView("classic")}
             >
                Classic (Zones)
             </button>
             <button
                className={`px-3 py-1 rounded ${view === "enhanced" ? "bg-blue-600" : "bg-zinc-700"}`}
                onClick={() => setView("enhanced")}
             >
                Enhanced NavMesh
             </button>
        </div>
      </div>
      <div className="flex-grow p-4 overflow-hidden">
        {view === "classic" ? (
             <MapDebugViewer mapData={DUST2_MAP} />
        ) : (
             <NavMeshVisualizer />
        )}
      </div>
    </div>
  );
}
