import type { ComponentProps, ReactElement, ReactNode } from 'react';

import { cn } from '../utils/cn.js';

/**
 * Minimal typing for `recharts`'s ResponsiveContainer — kept local so
 * consumers don't need to install @types/recharts just to reference this.
 */
interface ResponsiveContainerLike {
  aspect?: number;
  children: ReactElement;
  className?: string;
  height?: string | number;
  minHeight?: string | number;
  minWidth?: string | number;
  width?: string | number;
}

export interface ChartContainerProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Aspect ratio (overrides height when set). */
  aspect?: number;
  /** A single recharts chart element (`<LineChart>`, `<BarChart>`, etc.). */
  children: ReactElement;
  /** Height in pixels or a CSS length. Default: `240`. */
  height?: number | string;
  /** The recharts `ResponsiveContainer` component. Passed in to keep recharts as a peer, not a hard dep. */
  ResponsiveContainer: (props: ResponsiveContainerLike) => ReactNode;
  /** Width. Default: `'100%'`. */
  width?: number | string;
}

/**
 * Responsive wrapper for recharts charts that applies the shared token
 * palette (grid lines, axis text, tooltip chrome) via CSS custom
 * properties. Consumers pass in `ResponsiveContainer` from recharts —
 * this keeps the recharts dependency as a peer without needing a
 * conditional import.
 *
 * @example
 *   import { ResponsiveContainer, LineChart, Line } from 'recharts';
 *
 *   <ChartContainer ResponsiveContainer={ResponsiveContainer} height={260}>
 *     <LineChart data={data}>
 *       <Line dataKey="value" stroke="var(--chart-1)" />
 *     </LineChart>
 *   </ChartContainer>
 */
export function ChartContainer({
  aspect,
  children,
  className,
  height = 240,
  ResponsiveContainer,
  width = '100%',
  ...props
}: ChartContainerProps) {
  return (
    <div
      data-slot="chart-container"
      className={cn(
        'w-full',
        '[&_.recharts-cartesian-grid_line]:stroke-[var(--border)]',
        '[&_.recharts-cartesian-axis-tick-value]:fill-[var(--muted-foreground)]',
        '[&_.recharts-polar-grid_line]:stroke-[var(--border)]',
        '[&_.recharts-legend-item-text]:fill-[var(--foreground)]',
        '[&_.recharts-reference-line_line]:stroke-[var(--muted-foreground)]',
        '[&_.recharts-dot]:stroke-[var(--background)]',
        className,
      )}
      {...props}
    >
      <ResponsiveContainer width={width} height={height} aspect={aspect}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}
