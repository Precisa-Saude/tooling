import type { ComponentProps, ReactNode } from 'react';

import { Tabs, TabsIndicator, TabsList, TabsTrigger } from '../primitives/Tabs.js';
import { cn } from '../utils/cn.js';

export interface SlidingTabItem {
  /** Optional icon rendered before the label. */
  icon?: ReactNode;
  /** Stable key for the tab; matches `activeKey` / `onChange`. */
  key: string;
  /** Label text. */
  label: ReactNode;
}

export interface SlidingTabsProps extends Omit<ComponentProps<'div'>, 'children' | 'onChange'> {
  /** The currently active tab key. */
  activeKey: string;
  items: SlidingTabItem[];
  /** `sm` for compact tabs (h-7), `md` for default height (h-9). Default: `md`. */
  size?: 'sm' | 'md';
  /** Called with the new key when the user selects a tab. */
  onChange: (key: string) => void;
}

/**
 * Pill-shaped tab group with an animated indicator that slides behind
 * the active tab. Built on Base UI's `Tabs.Indicator` so the indicator
 * is measured + positioned without ResizeObserver boilerplate.
 *
 * Differs from the lower-level `Tabs` primitive by bundling a specific
 * visual treatment (rounded pill background, shadow on active) and a
 * simpler data-driven API.
 */
export function SlidingTabs({
  activeKey,
  className,
  items,
  onChange,
  size = 'md',
  ...props
}: SlidingTabsProps) {
  return (
    <div data-slot="sliding-tabs" className={cn('inline-block', className)} {...props}>
      <Tabs value={activeKey} onValueChange={(value) => onChange(String(value))}>
        <TabsList
          className={cn(
            'relative inline-flex items-center gap-1 rounded-full bg-muted p-1',
            size === 'sm' ? 'h-8' : 'h-10',
          )}
        >
          <TabsIndicator
            className={cn(
              'absolute rounded-full bg-background shadow-sm',
              'transition-all duration-200 ease-out',
              size === 'sm' ? 'h-6' : 'h-8',
            )}
          />
          {items.map((item) => (
            <TabsTrigger
              key={item.key}
              value={item.key}
              className={cn(
                'relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full',
                'text-sm font-medium text-muted-foreground transition-colors',
                'data-[selected=true]:text-foreground',
                "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                size === 'sm' ? 'h-6 px-3 text-xs' : 'h-8 px-4',
              )}
            >
              {item.icon ? <span aria-hidden>{item.icon}</span> : null}
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
