import type { ComponentProps, CSSProperties } from 'react';

/**
 * Presets for recharts' `<Tooltip>` `contentStyle` / `itemStyle` /
 * `labelStyle` props so every chart picks up the same token-backed
 * appearance.
 *
 * @example
 *   import { Tooltip } from 'recharts';
 *   import { chartTooltipStyles } from '@precisa-saude/ui/charts';
 *
 *   <Tooltip {...chartTooltipStyles} />
 */
export const chartTooltipStyles: {
  contentStyle: CSSProperties;
  itemStyle: CSSProperties;
  labelStyle: CSSProperties;
  cursor: { stroke: string; strokeWidth: number };
} = {
  contentStyle: {
    backgroundColor: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-md)',
    color: 'var(--popover-foreground)',
    fontSize: 12,
    padding: '8px 10px',
  },
  cursor: { stroke: 'var(--muted-foreground)', strokeWidth: 1 },
  itemStyle: { color: 'var(--foreground)', padding: 0 },
  labelStyle: { color: 'var(--muted-foreground)', fontWeight: 500, marginBottom: 4 },
};

/**
 * Convenience HTML tooltip cell for custom `<Tooltip content={...}>`
 * implementations — shares the styling cues with the defaults above.
 */
export function ChartTooltipBox({ className, style, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="chart-tooltip"
      role="tooltip"
      className={className}
      style={{
        ...chartTooltipStyles.contentStyle,
        ...style,
      }}
      {...props}
    />
  );
}
