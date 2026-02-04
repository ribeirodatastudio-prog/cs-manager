"use client";

import { useState } from "react";
import { Shell } from "@/components/layout/Shell";
import { RosterTable } from "@/components/dashboard/RosterTable";
import { PlayerCard } from "@/components/dashboard/PlayerCard";
import { MOCK_PLAYERS } from "@/lib/mock-players";
import { Activity, Trophy, TrendingUp, Users } from "lucide-react";

export default function DashboardPage() {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(MOCK_PLAYERS[0].id);

  // Find the selected player, fallback to first if not found
  const selectedPlayer = MOCK_PLAYERS.find(p => p.id === selectedPlayerId) || MOCK_PLAYERS[0];

  return (
    <Shell>
      <div className="space-y-8 max-w-7xl mx-auto">

        {/* Quick Stats Row (Decorative) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Team Rating", value: "16.8", icon: Activity, color: "text-primary" },
            { label: "Win Streak", value: "5", icon: TrendingUp, color: "text-green-500" },
            { label: "Tournaments", value: "3", icon: Trophy, color: "text-yellow-500" },
            { label: "Roster Size", value: "5", icon: Users, color: "text-blue-500" },
          ].map((stat) => (
            <div key={stat.label} className="bg-card border border-border p-4 flex items-center justify-between">
               <div>
                 <div className="text-xs text-muted-foreground uppercase tracking-widest">{stat.label}</div>
                 <div className="text-2xl font-bold text-foreground mt-1">{stat.value}</div>
               </div>
               <stat.icon className={`w-8 h-8 opacity-20 ${stat.color}`} />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Roster List */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">
            <div>
               <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider border-l-4 border-primary pl-3">
                 Active Roster
               </h2>
               <p className="text-sm text-muted-foreground mb-4">
                 Select a player to view detailed attribute analysis and performance metrics.
               </p>
               <RosterTable
                 players={MOCK_PLAYERS}
                 selectedPlayerId={selectedPlayerId}
                 onSelectPlayer={(p) => setSelectedPlayerId(p.id)}
               />
            </div>

            {/* Team Context (Optional Placeholder) */}
            <div className="bg-card border border-border p-6 opacity-75">
              <h3 className="font-bold text-white uppercase mb-2 text-sm">Team Synergies</h3>
              <p className="text-xs text-muted-foreground">
                Current roster balance is optimal. High tactical adaptability detected with current IGL/Lurker combo.
              </p>
            </div>
          </div>

          {/* Right Column: Detailed Player View */}
          <div className="lg:col-span-7 xl:col-span-8">
             <div className="flex items-center justify-between mb-4">
               <h2 className="text-lg font-bold text-white uppercase tracking-wider border-l-4 border-accent pl-3">
                 Player Analysis
               </h2>
             </div>

             <PlayerCard player={selectedPlayer} />
          </div>
        </div>
      </div>
    </Shell>
  );
}
