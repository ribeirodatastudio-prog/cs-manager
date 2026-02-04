import { Player } from "@/types";
import { getSkillDisplayValue, cn } from "@/lib/utils";
import { SkillBadge } from "@/components/ui/SkillBadge";
import { User, Globe, Crosshair, Brain, Activity } from "lucide-react";

interface PlayerCardProps {
  player: Player;
  className?: string;
}

/**
 * Helper to convert camelCase to Title Case.
 * e.g. "crosshairPlacement" -> "Crosshair Placement"
 */
function formatSkillName(key: string): string {
  // Split by capital letters
  const result = key.replace(/([A-Z])/g, " $1");
  // Capitalize first letter
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export function PlayerCard({ player, className }: PlayerCardProps) {

  const renderSkillSection = (
    title: string,
    icon: React.ReactNode,
    skills: Record<string, number>
  ) => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-white/10">
        {icon}
        <h3 className="font-bold text-lg text-primary uppercase tracking-wider">{title}</h3>
      </div>
      <div className="space-y-3">
        {Object.entries(skills).map(([key, rawValue]) => {
          const displayValue = getSkillDisplayValue(rawValue);
          // Calculate percentage for the bar (0-200 scale -> 0-100%)
          const percentage = Math.min(100, rawValue / 2);

          return (
            <div key={key} className="group">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {formatSkillName(key)}
                </span>
                <SkillBadge value={displayValue} />
              </div>
              {/* Progress Bar Background */}
              <div className="h-2 w-full bg-secondary overflow-hidden">
                {/* Progress Bar Fill */}
                <div
                  className={cn(
                    "h-full transition-all duration-500",
                    displayValue <= 10 ? "bg-skill-low" :
                    displayValue <= 15 ? "bg-skill-mid" :
                    "bg-skill-high"
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={cn("bg-card text-card-foreground border border-border p-6 shadow-lg", className)}>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-white/10 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-secondary flex items-center justify-center border-2 border-primary">
             {player.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
             ) : (
                <User className="w-8 h-8 text-primary" />
             )}
          </div>
          <div>
            <h2 className="text-2xl font-bold uppercase tracking-tight text-white">{player.name}</h2>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
               <div className="flex items-center gap-1">
                 <Globe className="w-3 h-3" />
                 {player.nationality}
               </div>
               <div className="px-2 py-0.5 bg-secondary text-secondary-foreground text-xs uppercase font-bold border border-white/5">
                 {player.role}
               </div>
               <div>{player.age} Years Old</div>
            </div>
          </div>
        </div>

        {/* Overall Rating (Optional) or just visual flair */}
        <div className="text-right hidden md:block">
           <div className="text-xs text-muted-foreground uppercase tracking-widest">Team</div>
           <div className="text-xl font-bold text-accent">Natus Vincere</div>
        </div>
      </div>

      {/* Skills Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {renderSkillSection("Technical", <Crosshair className="w-5 h-5 text-accent" />, player.skills.technical as unknown as Record<string, number>)}
        {renderSkillSection("Mental", <Brain className="w-5 h-5 text-accent" />, player.skills.mental as unknown as Record<string, number>)}
        {renderSkillSection("Physical", <Activity className="w-5 h-5 text-accent" />, player.skills.physical as unknown as Record<string, number>)}
      </div>
    </div>
  );
}
