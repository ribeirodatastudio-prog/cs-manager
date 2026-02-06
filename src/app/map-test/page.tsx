import React from 'react';
import { Dust2Map } from '@/components/Dust2Map';

export default function MapTestPage() {
  return (
    <div className="w-screen h-screen bg-black flex flex-col items-center justify-center">
      <h1 className="text-white text-xl mb-4">Dust 2 Navigation Graph Visualization</h1>

      <div className="relative w-[1000px] h-[1000px] border border-zinc-700">
        {/* Optional: Background Image for context (might not align yet) */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
           <img
             src="/dust2_2d.png"
             alt="Dust 2 Background"
             className="w-full h-full object-cover"
           />
        </div>

        {/* The Map Component */}
        <Dust2Map className="bg-transparent/50" />
      </div>

      <div className="mt-4 text-zinc-400 text-sm max-w-lg text-center">
        <p>
          Rendering nodes from <code>src/data/de_dust2_web.json</code>.
          <br/>
          Coordinates are mapped directly from Game Units to SVG ViewBox.
        </p>
      </div>
    </div>
  );
}
