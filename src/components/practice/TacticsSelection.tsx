import React from "react";
import { Tactic, TeamSide } from "@/lib/engine/TacticsManager";
import { Activity, ArrowRight, ArrowLeft, Play, ShieldAlert, Swords } from "lucide-react";

interface TacticsSelectionProps {
  tacticT: Tactic;
  tacticCT: Tactic;
  onTacticChange: (side: TeamSide, tactic: Tactic) => void;
  onStart: () => void;
  onBack: () => void;
}

const T_TACTICS: { value: Tactic; label: string; desc: string }[] = [
  { value: "DEFAULT", label: "Default", desc: "Standard map control and defaults." },
  { value: "RUSH_A", label: "Rush A", desc: "Fast pace attack towards site A." },
  { value: "RUSH_B", label: "Rush B", desc: "Fast pace attack towards site B." },
  { value: "EXECUTE_A", label: "Execute A", desc: "Structured utility usage and entry on A." },
  { value: "EXECUTE_B", label: "Execute B", desc: "Structured utility usage and entry on B." },
  { value: "SPLIT_A", label: "Split A", desc: "Coordinated pincer attack on A." },
  { value: "SPLIT_B", label: "Split B", desc: "Coordinated pincer attack on B." },
  { value: "CONTACT_A", label: "Contact A", desc: "Stealthy approach until enemy contact." },
  { value: "CONTACT_B", label: "Contact B", desc: "Stealthy approach until enemy contact." },
];

const CT_TACTICS: { value: Tactic; label: string; desc: string }[] = [
  { value: "STANDARD", label: "Standard (2-1-2)", desc: "Balanced defense across the map." },
  { value: "AGGRESSIVE_PUSH", label: "Aggressive Push", desc: "Take map control early for info." },
  { value: "GAMBLE_STACK_A", label: "Stack A", desc: "Heavy defense on A (4-1 setup)." },
  { value: "GAMBLE_STACK_B", label: "Stack B", desc: "Heavy defense on B (4-1 setup)." },
  { value: "RETAKE_SETUP", label: "Retake Setup", desc: "Passive hold prepared for retake." },
];

export const TacticsSelection: React.FC<TacticsSelectionProps> = ({
  tacticT,
  tacticCT,
  onTacticChange,
  onStart,
  onBack,
}) => {

  const renderOption = (
    item: { value: Tactic; label: string; desc: string },
    current: Tactic,
    side: TeamSide
  ) => {
    const isSelected = current === item.value;
    const isT = side === TeamSide.T;
    const activeBorder = isT ? "border-yellow-500" : "border-blue-500";
    const activeBg = isT ? "bg-yellow-500/10" : "bg-blue-500/10";
    const activeText = isT ? "text-yellow-500" : "text-blue-500";

    return (
      <button
        key={item.value}
        onClick={() => onTacticChange(side, item.value)}
        className={`w-full text-left p-4 border rounded transition-all relative ${
          isSelected
            ? `${activeBorder} ${activeBg}`
            : "border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800 hover:border-zinc-600"
        }`}
      >
        <div className="flex justify-between items-center mb-1">
            <span className={`font-bold ${isSelected ? "text-white" : "text-zinc-300"}`}>
                {item.label}
            </span>
            {isSelected && <div className={`w-2 h-2 rounded-full ${isT ? "bg-yellow-500" : "bg-blue-500"}`} />}
        </div>
        <div className="text-xs text-zinc-500">{item.desc}</div>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white">
       {/* Header */}
       <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-900">
        <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-zinc-400" />
            <h1 className="text-2xl font-bold tracking-tight">Strategy Board</h1>
        </div>
        <div className="flex gap-4">
             <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={onStart}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white font-bold hover:bg-green-500 rounded transition-colors shadow-lg shadow-green-900/20"
            >
              <Play className="w-4 h-4 fill-current" />
              Start Simulation
            </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-2 gap-0 overflow-hidden">
          {/* T Side Panel */}
          <div className="overflow-y-auto p-8 border-r border-zinc-900">
             <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-900">
                 <div className="p-2 bg-yellow-500/10 rounded">
                     <Swords className="w-6 h-6 text-yellow-500" />
                 </div>
                 <div>
                     <h2 className="text-xl font-bold text-white">T Strategy</h2>
                     <p className="text-sm text-zinc-500">Select attacking protocol</p>
                 </div>
             </div>
             <div className="grid gap-3">
                 {T_TACTICS.map(t => renderOption(t, tacticT, TeamSide.T))}
             </div>
          </div>

          {/* CT Side Panel */}
          <div className="overflow-y-auto p-8">
             <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-900">
                 <div className="p-2 bg-blue-500/10 rounded">
                     <ShieldAlert className="w-6 h-6 text-blue-500" />
                 </div>
                 <div>
                     <h2 className="text-xl font-bold text-white">CT Strategy</h2>
                     <p className="text-sm text-zinc-500">Select defensive setup</p>
                 </div>
             </div>
             <div className="grid gap-3">
                 {CT_TACTICS.map(t => renderOption(t, tacticCT, TeamSide.CT))}
             </div>
          </div>
      </div>
    </div>
  );
};
