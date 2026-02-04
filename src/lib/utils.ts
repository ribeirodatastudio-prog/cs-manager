import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS classes conditionally.
 * Combines clsx for conditional logic and tailwind-merge to handle conflicts.
 *
 * @param inputs - List of class names or conditional class objects
 * @returns Merged class string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts a raw skill attribute (1-200) into a displayable 1-20 score.
 * The logic is to divide by 10 and round down (floor), with a minimum value of 1.
 *
 * Example:
 * - 189 becomes 18
 * - 200 becomes 20
 * - 5 becomes 1
 *
 * @param value - The raw integer skill value (expected 1-200)
 * @returns The scaled integer value (1-20)
 */
export function getSkillDisplayValue(value: number): number {
  // Ensure we don't return 0 for very low skills (e.g. 1-9)
  if (value < 10) return 1;

  // Basic floor division
  const scaled = Math.floor(value / 10);

  // Clamp between 1 and 20 just in case
  return Math.max(1, Math.min(20, scaled));
}
