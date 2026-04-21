import { useCallback, useEffect, useState } from 'react';

import { useWideGrid } from '../hooks/useWideGrid.js';

type GridMode = 'off' | 'columns' | 'guides';

export interface GridOverlayProps {
  /**
   * Key to press to cycle modes (off → columns → guides → off).
   * Default: `g`.
   */
  cycleKey?: string;
  /**
   * Whether the overlay is active. Typically wired to a dev-mode flag:
   *
   *   <GridOverlay enabled={import.meta.env.DEV} />
   *
   * When `false`, the component renders nothing and ignores the keypress.
   * Default: `false` (safe to import in production).
   */
  enabled?: boolean;
  /**
   * localStorage key used to persist the active mode across reloads.
   * Default: `precisa-grid-overlay`. Pass an empty string to disable persistence.
   */
  storageKey?: string;
}

const DEFAULT_KEY = 'g';
const DEFAULT_STORAGE_KEY = 'precisa-grid-overlay';

/**
 * Fixed overlay that visualizes the shared 14/16-col responsive grid.
 * Press the cycle key (default `g`) to toggle off → columns → guides.
 *
 * Designed for dev builds only — pass `enabled={import.meta.env.DEV}` (or
 * equivalent). Requires the CSS variable `--grid-max-w` from
 * `@precisa-saude/themes/grid.css`.
 */
export function GridOverlay({
  cycleKey = DEFAULT_KEY,
  enabled = false,
  storageKey = DEFAULT_STORAGE_KEY,
}: GridOverlayProps = {}) {
  const [mode, setMode] = useState<GridMode>(() => {
    if (!enabled || !storageKey) return 'off';
    if (typeof window === 'undefined') return 'off';
    try {
      const stored = window.localStorage.getItem(storageKey) as GridMode | null;
      return stored === 'columns' || stored === 'guides' ? stored : 'off';
    } catch {
      return 'off';
    }
  });

  const cycle = useCallback(() => {
    setMode((prev) => {
      const next: GridMode = prev === 'off' ? 'columns' : prev === 'columns' ? 'guides' : 'off';
      if (storageKey) {
        try {
          window.localStorage.setItem(storageKey, next);
        } catch {
          // ignore quota / privacy errors
        }
      }
      return next;
    });
  }, [storageKey]);

  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (target.isContentEditable) return;
      if (e.key === cycleKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        cycle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cycle, cycleKey, enabled]);

  const wide = useWideGrid();
  const totalCols = wide ? 16 : 14;
  const gutterCols = wide ? 2 : 1;

  if (!enabled || mode === 'off') return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[9999]">
      <div className="flex h-full items-stretch justify-center">
        <div
          className="hidden h-full w-full gap-4 md:grid"
          style={{
            gridTemplateColumns: `repeat(${totalCols}, 1fr)`,
            margin: '0 auto',
            maxWidth: 'var(--grid-max-w)',
          }}
        >
          {Array.from({ length: totalCols }).map((_, i) => {
            const isGutter = i < gutterCols || i >= totalCols - gutterCols;
            return (
              <div
                key={i}
                className="h-full"
                style={{
                  backgroundColor: isGutter ? 'rgba(255, 0, 0, 0.04)' : 'rgba(255, 0, 0, 0.07)',
                  outline: `1px ${isGutter ? 'dashed' : 'solid'} rgba(255, 0, 0, 0.25)`,
                }}
              />
            );
          })}
        </div>
        <div
          className="grid h-full w-full gap-4 px-4 md:hidden"
          style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-full"
              style={{
                backgroundColor: 'rgba(255, 0, 0, 0.07)',
                outline: '1px solid rgba(255, 0, 0, 0.25)',
              }}
            />
          ))}
        </div>
      </div>

      {mode === 'guides' && (
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="h-full w-full"
            style={{
              backgroundImage:
                'repeating-linear-gradient(to bottom, transparent, transparent 63px, rgba(0, 200, 255, 0.3) 63px, rgba(0, 200, 255, 0.3) 64px)',
            }}
          />
        </div>
      )}

      <div className="fixed right-3 bottom-3 rounded-md bg-black/70 px-2 py-1 font-mono text-[10px] text-white">
        grid: {mode} <span className="text-white/50">({cycleKey})</span>
      </div>
    </div>
  );
}
