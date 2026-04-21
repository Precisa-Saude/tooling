import { useWideGrid } from '../hooks/useWideGrid.js';

export interface CornerSquaresProps {
  /** Accent color — defaults to `var(--ps-mint)`. */
  accentColor?: string;
  /** Top-right (default) or bottom-right corner. */
  position?: 'top' | 'bottom';
  /** Primary color — defaults to `var(--ps-violet)`. */
  primaryColor?: string;
}

const GRID_CONTAINER_STYLE = {
  gap: '16px',
  gridTemplateColumns: 'repeat(var(--grid-cols), 1fr)',
  margin: '0 auto',
  maxWidth: 'var(--grid-max-w)',
  width: '100%',
} as const;

const SQUARE_SIZE = { height: 'var(--col-w)', width: 'var(--col-w)' } as const;

/**
 * Two decorative squares anchored to a corner of the grid, aligned to
 * the shared 14/16-col responsive system. Visible at ≥768px; hidden on
 * mobile.
 *
 * Requires the CSS variables `--grid-cols`, `--grid-max-w`, and
 * `--col-w` — shipped by `@precisa-saude/themes/grid.css`.
 */
export function CornerSquares({
  accentColor = 'var(--ps-mint)',
  position = 'top',
  primaryColor = 'var(--ps-violet)',
}: CornerSquaresProps) {
  const wide = useWideGrid();
  const offset = wide ? 2 : 0;

  if (position === 'bottom') {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden md:grid"
        style={GRID_CONTAINER_STYLE}
      >
        <div className="flex flex-col" style={{ gridColumn: `${14 + offset}` }}>
          <div style={{ backgroundColor: accentColor, ...SQUARE_SIZE }} />
          <div style={{ backgroundColor: primaryColor, ...SQUARE_SIZE }} />
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-10 hidden overflow-hidden md:grid"
      style={GRID_CONTAINER_STYLE}
    >
      <div className="flex justify-end" style={{ gridColumn: `${13 + offset} / span 2` }}>
        <div style={{ backgroundColor: primaryColor, ...SQUARE_SIZE }} />
        <div style={{ backgroundColor: accentColor, ...SQUARE_SIZE }} />
      </div>
    </div>
  );
}
