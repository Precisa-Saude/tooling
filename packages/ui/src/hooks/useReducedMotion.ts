import { useMediaQuery } from './useMediaQuery.js';

/**
 * `true` when the user has `prefers-reduced-motion: reduce` set at the OS level.
 *
 * Use to disable non-essential animations (marquees, parallax, large transitions).
 * Essential motion (e.g. feedback on interactive state) may still run.
 */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
