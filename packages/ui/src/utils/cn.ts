import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind class strings with conflict resolution.
 *
 * Accepts anything clsx accepts (strings, arrays, objects). Later classes
 * in Tailwind conflict groups (e.g. `px-2 px-4`) overwrite earlier ones.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
