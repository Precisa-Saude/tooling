import { ChevronDownIcon, ChevronRightIcon, SearchIcon } from 'lucide-react';
import { type ComponentProps, type ReactNode, useMemo, useState } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '../primitives/Popover.js';
import { cn } from '../utils/cn.js';

export interface NavigationalBreadcrumbOption {
  /** Optional icon. */
  icon?: ReactNode;
  /** Stable id. */
  id: string;
  /** Display label — matched case-insensitively against the search query. */
  label: ReactNode;
  /** Whether this option is the currently selected one (renders a check). */
  selected?: boolean;
  /** Status color dot (maps to `--status-*` tokens). */
  status?: 'success' | 'warning' | 'elevated' | 'critical' | 'info';
}

export interface NavigationalBreadcrumbSegment {
  /** Link target when tapped alone (optional — when items is also set, the segment is a combobox). */
  href?: string;
  /** List of sibling options shown when the user opens the segment. */
  items?: NavigationalBreadcrumbOption[];
  /** Label for the segment button. */
  label: ReactNode;
  /** Whether to render a search input above the option list. Default: auto (true when items.length > 6). */
  searchable?: boolean;
  /** Placeholder for the search input. */
  searchPlaceholder?: string;
  /** Called when an option is picked. */
  onSelect?: (option: NavigationalBreadcrumbOption) => void;
}

export interface NavigationalBreadcrumbsProps extends Omit<ComponentProps<'nav'>, 'children'> {
  segments: NavigationalBreadcrumbSegment[];
}

const STATUS_DOT_CLASS: Record<NonNullable<NavigationalBreadcrumbOption['status']>, string> = {
  critical: 'bg-[var(--status-critical)]',
  elevated: 'bg-[var(--status-elevated)]',
  info: 'bg-[var(--status-info)]',
  success: 'bg-[var(--status-success)]',
  warning: 'bg-[var(--status-warning)]',
};

/**
 * Breadcrumbs where each segment can open a searchable dropdown of
 * sibling options. Intended for deep hierarchies where jumping
 * laterally is common (e.g. picking a different item at the same
 * depth without navigating up first).
 *
 * Segments without `items` render as plain links (same as
 * `Breadcrumbs`). Segments with `items` render as a combobox trigger.
 */
export function NavigationalBreadcrumbs({
  className,
  segments,
  ...props
}: NavigationalBreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      data-slot="navigational-breadcrumbs"
      className={cn('text-sm', className)}
      {...props}
    >
      <ol className="flex flex-wrap items-center gap-1 text-muted-foreground">
        {segments.map((segment, i) => {
          const isLast = i === segments.length - 1;
          return (
            <li
              key={i}
              className="flex items-center gap-1"
              aria-current={isLast ? 'page' : undefined}
            >
              <Segment segment={segment} isLast={isLast} />
              {!isLast ? (
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Segment({ isLast, segment }: { segment: NavigationalBreadcrumbSegment; isLast: boolean }) {
  if (!segment.items || segment.items.length === 0) {
    // Plain link segment
    if (isLast || !segment.href) {
      return <span className={cn(isLast && 'font-medium text-foreground')}>{segment.label}</span>;
    }
    return (
      <a href={segment.href} className="hover:text-foreground hover:underline">
        {segment.label}
      </a>
    );
  }

  return <ComboboxSegment segment={segment} isLast={isLast} />;
}

function ComboboxSegment({
  isLast,
  segment,
}: {
  segment: NavigationalBreadcrumbSegment;
  isLast: boolean;
}) {
  const items = segment.items ?? [];
  const [query, setQuery] = useState('');
  const searchable = segment.searchable ?? items.length > 6;

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const raw = typeof it.label === 'string' ? it.label : String(it.label ?? '');
      return raw.toLowerCase().includes(q);
    });
  }, [items, query]);

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors',
          'hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isLast && 'font-medium text-foreground',
        )}
      >
        {segment.label}
        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        {searchable ? (
          <div className="relative mb-1">
            <SearchIcon
              className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={segment.searchPlaceholder ?? 'Search…'}
              className={cn(
                'h-8 w-full rounded-sm border border-transparent bg-transparent pl-7 pr-2 text-sm',
                'outline-none placeholder:text-muted-foreground',
                'focus:border-ring focus:ring-2 focus:ring-ring/20',
              )}
            />
          </div>
        ) : null}
        <ul className="max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-2 py-2 text-xs text-muted-foreground">No matches.</li>
          ) : (
            filtered.map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => segment.onSelect?.(opt)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                    'transition-colors hover:bg-muted',
                    opt.selected && 'text-foreground',
                  )}
                >
                  {opt.status ? (
                    <span
                      aria-hidden
                      className={cn('size-2 shrink-0 rounded-full', STATUS_DOT_CLASS[opt.status])}
                    />
                  ) : null}
                  {opt.icon ? <span aria-hidden>{opt.icon}</span> : null}
                  <span className="flex-1">{opt.label}</span>
                  {opt.selected ? (
                    <span aria-hidden className="text-primary">
                      ✓
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
