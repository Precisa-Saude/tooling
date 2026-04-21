import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Button } from '../primitives/Button.js';
import { cn } from '../utils/cn.js';

export interface PaginationProps extends Omit<ComponentProps<'nav'>, 'onChange'> {
  /** 1-indexed current page. */
  page: number;
  /** Items per page — used to compute the last page when `total` is set. */
  pageSize: number;
  /** Page-size picker options. Default: `[10, 20, 50, 100]`. */
  pageSizeOptions?: number[];
  /** Max number of page-number buttons to render. Default: `7`. */
  siblingCount?: number;
  /** Total item count. Required to render the last-page bound. */
  total: number;
  /** Called with the new 1-indexed page when the user picks one. */
  onPageChange: (page: number) => void;
  /** Optional: called when the user picks a new page size (renders the picker). */
  onPageSizeChange?: (pageSize: number) => void;
}

function range(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

/**
 * Compute the visible page-number slots with ellipses.
 * Simple rule: show first, last, and a window around current.
 */
function pageItems(current: number, totalPages: number, max: number): Array<number | '...'> {
  if (totalPages <= max) return range(1, totalPages);
  const half = Math.floor((max - 2) / 2); // reserve 2 slots for first + last
  const start = Math.max(2, current - half);
  const end = Math.min(totalPages - 1, current + half);
  const items: Array<number | '...'> = [1];
  if (start > 2) items.push('...');
  items.push(...range(start, end));
  if (end < totalPages - 1) items.push('...');
  items.push(totalPages);
  return items;
}

/**
 * Numbered pagination with Prev / Next and an optional page-size selector.
 *
 * Uses `Button` primitives for consistent styling. The page-size selector
 * is rendered as a plain `<select>` to keep this component free of Base
 * UI dependencies; swap for the Select primitive in consumer code if you
 * need consistent styling across select and pagination.
 */
export function Pagination({
  className,
  onPageChange,
  onPageSizeChange,
  page,
  pageSize,
  pageSizeOptions = [10, 20, 50, 100],
  siblingCount = 7,
  total,
  ...props
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const items = pageItems(page, totalPages, siblingCount);
  const atFirst = page <= 1;
  const atLast = page >= totalPages;

  return (
    <nav
      aria-label="Pagination"
      data-slot="pagination"
      className={cn('flex items-center justify-between gap-4', className)}
      {...props}
    >
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          disabled={atFirst}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon />
        </Button>

        {items.map((item, i) =>
          item === '...' ? (
            <span
              key={`ellipsis-${i}`}
              aria-hidden
              className="px-1.5 text-sm text-muted-foreground"
            >
              …
            </span>
          ) : (
            <Button
              key={item}
              variant={item === page ? 'default' : 'ghost'}
              size="sm"
              aria-current={item === page ? 'page' : undefined}
              onClick={() => onPageChange(item)}
            >
              {item}
            </Button>
          ),
        )}

        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          disabled={atLast}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRightIcon />
        </Button>
      </div>

      {onPageSizeChange ? (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Rows</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className={cn(
              'h-7 rounded-md border border-input bg-transparent px-1.5 text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </nav>
  );
}
