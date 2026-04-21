import { useDesktop, useWideGrid } from './useWideGrid.js';

type GridColStyle = { gridColumn: string } | undefined;

/**
 * Returns a callable that builds a `gridColumn` inline style for the
 * shared 14/16-col responsive grid.
 *
 * - On mobile (<768px): returns `undefined`, letting column-span utilities
 *   fall back to `col-span-full`.
 * - On desktop (≥768px): returns `{ gridColumn: 'N / span M' }`.
 * - At ≥1440px (wide grid): shifts `start` by +1 to account for the
 *   extra column.
 *
 * Example:
 *   const col = useGridCol();
 *   <div style={col(3, 6)}>...</div>
 */
export function useGridCol(): (start: number, span: number) => GridColStyle {
  const desktop = useDesktop();
  const wide = useWideGrid();
  const offset = wide ? 1 : 0;

  return (start, span) =>
    desktop ? { gridColumn: `${start + offset} / span ${span}` } : undefined;
}
