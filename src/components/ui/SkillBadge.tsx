import { cn } from "@/lib/utils";

interface SkillBadgeProps {
  value: number; // The 1-20 display value
  className?: string;
}

/**
 * A reusable badge component that displays a skill score (1-20).
 * Color coding:
 * - 1-10: Red (Low)
 * - 11-15: Yellow (Mid)
 * - 16-20: Green (High)
 */
export function SkillBadge({ value, className }: SkillBadgeProps) {
  // Determine color styles based on score range
  let colorStyles = "";

  if (value <= 10) {
    colorStyles = "bg-skill-low text-white border-red-700";
  } else if (value <= 15) {
    colorStyles = "bg-skill-mid text-black border-yellow-700";
  } else {
    colorStyles = "bg-skill-high text-black border-green-700";
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center w-8 h-8 font-mono text-sm font-bold border shadow-sm select-none",
        colorStyles,
        className
      )}
    >
      {value}
    </div>
  );
}
