import { ChevronRightIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '../utils/cn.js';

export interface BreadcrumbSegment {
  /** Optional link target. If omitted, the segment renders as plain text. */
  href?: string;
  /** Custom icon rendered before the label. */
  icon?: ReactNode;
  /** Text displayed for this segment. */
  label: ReactNode;
}

export interface BreadcrumbsProps extends Omit<ComponentProps<'nav'>, 'children'> {
  /** Ordered list of breadcrumb segments from root to current page. */
  segments: BreadcrumbSegment[];
  /** Custom separator between segments. Default: `<ChevronRightIcon />`. */
  separator?: ReactNode;
}

/**
 * Simple display breadcrumbs. For a segment with a searchable dropdown
 * (each level opens a list of siblings), see `NavigationalBreadcrumbs`
 * (planned).
 *
 * The final segment is rendered as the current page (no link) regardless
 * of whether `href` is provided.
 */
export function Breadcrumbs({ className, segments, separator, ...props }: BreadcrumbsProps) {
  const sep = separator ?? (
    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
  );

  return (
    <nav
      aria-label="Breadcrumb"
      data-slot="breadcrumbs"
      className={cn('text-sm', className)}
      {...props}
    >
      <ol className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
        {segments.map((segment, i) => {
          const isLast = i === segments.length - 1;
          const content = (
            <span className="flex items-center gap-1">
              {segment.icon ? <span aria-hidden>{segment.icon}</span> : null}
              {segment.label}
            </span>
          );

          return (
            <li
              key={i}
              className="flex items-center gap-1.5"
              aria-current={isLast ? 'page' : undefined}
            >
              {isLast || !segment.href ? (
                <span className={cn(isLast && 'font-medium text-foreground')}>{content}</span>
              ) : (
                <a href={segment.href} className="hover:text-foreground hover:underline">
                  {content}
                </a>
              )}
              {!isLast ? sep : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
