import { Player } from "@/types";
import { cn } from "@/lib/utils";
import { User, Globe } from "lucide-react";

interface RosterTableProps {
  players: Player[];
  onSelectPlayer?: (player: Player) => void;
  selectedPlayerId?: string;
  className?: string;
}

/**
 * Calculates a simple average rating (1-20) from all player skills.
 */
function calculateAverageRating(player: Player): string {
  const tech = Object.values(player.skills.technical);
  const mental = Object.values(player.skills.mental);
  const physical = Object.values(player.skills.physical);

  const allSkills = [...tech, ...mental, ...physical];
  const sum = allSkills.reduce((a, b) => a + b, 0);
  const avgRaw = sum / allSkills.length;

  // Convert to 1-20 scale (with decimal for precision in summary)
  return (avgRaw / 10).toFixed(1);
}

export function RosterTable({ players, onSelectPlayer, selectedPlayerId, className }: RosterTableProps) {
  return (
    <div className={cn("w-full overflow-hidden border border-border bg-card shadow-sm", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-secondary text-secondary-foreground text-xs uppercase font-bold tracking-wider">
            <tr>
              <th className="px-6 py-4">Player</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Nationality</th>
              <th className="px-6 py-4">Age</th>
              <th className="px-6 py-4 text-right">Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card/50">
            {players.map((player) => {
              const rating = calculateAverageRating(player);
              const isSelected = selectedPlayerId === player.id;

              return (
                <tr
                  key={player.id}
                  onClick={() => onSelectPlayer?.(player)}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-white/5",
                    isSelected ? "bg-primary/10 border-l-2 border-l-primary" : ""
                  )}
                >
                  <td className="px-6 py-4 font-medium text-foreground flex items-center gap-3">
                    <div className="w-8 h-8 bg-secondary flex items-center justify-center border border-white/10 text-muted-foreground">
                      <User className="w-4 h-4" />
                    </div>
                    {player.name}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    <span className="px-2 py-1 bg-secondary text-xs uppercase font-bold border border-white/5 text-foreground">
                      {player.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground flex items-center gap-2">
                    <Globe className="w-3 h-3 text-accent" />
                    {player.nationality}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {player.age}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-primary">
                    {rating}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
