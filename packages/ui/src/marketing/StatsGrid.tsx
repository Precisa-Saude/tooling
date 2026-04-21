import type { ComponentProps, ReactNode } from 'react';

import { cn } from '../utils/cn.js';

export interface StatItem {
  /** Optional small hint rendered below the value (e.g. delta, unit). */
  hint?: ReactNode;
  /** Small caption rendered above the value. */
  label: ReactNode;
  /** The prominent figure. */
  value: ReactNode;
}

export interface StatsGridProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Column count on ≥md viewports. Default: `items.length` (up to 4). */
  columns?: 2 | 3 | 4;
  /** Data for each stat cell. */
  items: StatItem[];
}

const COLUMN_CLASSES: Record<2 | 3 | 4, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
};

/**
 * Grid of stat cards (label + value + optional hint). Two columns on
 * mobile, configurable on desktop.
 *
 * @example
 *   <StatsGrid items={[
 *     { label: 'Biomarkers', value: '180+' },
 *     { label: 'Coverage', value: '94%', hint: 'of tests on the market' },
 *     { label: 'Languages', value: 'pt-BR' },
 *   ]} />
 */
export function StatsGrid({ className, columns, items, ...props }: StatsGridProps) {
  const cols = (columns ?? Math.min(items.length, 4)) as 2 | 3 | 4;

  return (
    <div
      data-slot="stats-grid"
      className={cn('grid grid-cols-2 gap-4', COLUMN_CLASSES[cols], className)}
      {...props}
    >
      {items.map((item, i) => (
        <div
          key={i}
          data-slot="stats-grid-item"
          className={cn('flex flex-col gap-1 rounded-lg border bg-card p-4 text-card-foreground')}
        >
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{item.label}</div>
          <div className="text-2xl font-semibold leading-tight">{item.value}</div>
          {item.hint ? <div className="text-xs text-muted-foreground">{item.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}
