import type { ComponentProps, ReactNode } from 'react';

import { cn } from '../utils/cn.js';

export interface FeatureItem {
  /** Feature description / body. */
  description?: ReactNode;
  /** Optional link slot (rendered below description). */
  footer?: ReactNode;
  /** Icon rendered at the top of the card (typically a lucide icon). */
  icon?: ReactNode;
  /** Feature headline. */
  title: ReactNode;
}

export interface FeatureGridProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Columns on ≥md viewports. Default: `3` (or `items.length` if smaller). */
  columns?: 2 | 3 | 4;
  items: FeatureItem[];
}

const COLUMN_CLASSES: Record<2 | 3 | 4, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
};

/**
 * Grid of feature cards (icon + title + description + optional footer).
 * One column on mobile, configurable on desktop.
 *
 * @example
 *   <FeatureGrid items={[
 *     { icon: <Activity/>, title: 'Biomarkers',  description: '180+ covered with LOINC.' },
 *     { icon: <HeartPulse/>, title: 'Calculators', description: 'PhenoAge, HOMA-IR, BrDMRisc.' },
 *   ]} />
 */
export function FeatureGrid({ className, columns, items, ...props }: FeatureGridProps) {
  const cols = (columns ?? Math.min(Math.max(items.length, 2), 4)) as 2 | 3 | 4;

  return (
    <div
      data-slot="feature-grid"
      className={cn('grid grid-cols-1 gap-6', COLUMN_CLASSES[cols], className)}
      {...props}
    >
      {items.map((item, i) => (
        <article
          key={i}
          data-slot="feature-grid-item"
          className={cn('flex flex-col gap-3 rounded-lg border bg-card p-6 text-card-foreground')}
        >
          {item.icon ? (
            <div className="text-primary [&>svg]:size-6" aria-hidden>
              {item.icon}
            </div>
          ) : null}
          <h3 className="text-base font-semibold leading-snug">{item.title}</h3>
          {item.description ? (
            <p className="text-sm text-muted-foreground">{item.description}</p>
          ) : null}
          {item.footer ? <div className="mt-auto pt-2">{item.footer}</div> : null}
        </article>
      ))}
    </div>
  );
}
