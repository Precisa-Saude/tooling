import { useMediaQuery } from './useMediaQuery.js';

/**
 * `true` when the viewport is ≥1440px — the breakpoint where the shared
 * grid switches from 14 to 16 columns (see `@precisa-saude/themes/grid.css`).
 */
export function useWideGrid(): boolean {
  return useMediaQuery('(min-width: 1440px)');
}

/**
 * `true` when the viewport is ≥768px (Tailwind's `md` breakpoint).
 */
export function useDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)');
}
