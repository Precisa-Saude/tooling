import type { ComponentProps, ReactNode } from 'react';

import { Badge } from '../primitives/Badge.js';
import { cn } from '../utils/cn.js';

export interface NewsCardProps extends Omit<ComponentProps<'article'>, 'children' | 'title'> {
  /** Override the rendered element for the root. */
  as?: 'article' | 'a' | 'div';
  /** Body paragraph / abstract. */
  excerpt?: ReactNode;
  /** Click target. Renders the card as an `<a>` when provided. */
  href?: string;
  /** Optional hero image. Rendered prominently in `hero` layout, omitted in `compact`. */
  image?: { src: string; alt: string };
  /** `hero` (with image, larger type) or `compact` (text-only, denser). Default: `compact`. */
  layout?: 'hero' | 'compact';
  /** Locale-formatted publication date (e.g. `'11/04/2026, 12:46'`). Pass a Date or string. */
  publishedAt?: Date | string;
  /** Publication source or channel name (rendered as a badge). */
  source?: ReactNode;
  /** Topical tag labels rendered as pills at the bottom. */
  tags?: string[];
  /** Headline. */
  title: ReactNode;
}

function formatDate(date: Date | string | undefined): string | undefined {
  if (!date) return undefined;
  if (typeof date === 'string') return date;
  try {
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return date.toISOString();
  }
}

/**
 * Card for news / blog / updates with two layouts:
 *
 * - `compact` (default) — no image. Source badge, title, date, excerpt, tag pills.
 *   Dense stacking for grid usage.
 * - `hero` — prominent image on top, same content stacked below. Suited for
 *   featured items at the top of a news list.
 *
 * When `href` is provided, the whole card is rendered as an `<a>`.
 */
export function NewsCard({
  as,
  className,
  excerpt,
  href,
  image,
  layout = 'compact',
  publishedAt,
  source,
  tags,
  title,
  ...props
}: NewsCardProps) {
  const Tag = as ?? (href ? 'a' : 'article');
  const formattedDate = formatDate(publishedAt);
  const isHero = layout === 'hero';

  const rootProps = {
    className: cn(
      'flex flex-col overflow-hidden rounded-lg border bg-card text-card-foreground',
      'transition-colors',
      href ? 'hover:bg-muted/50 cursor-pointer' : undefined,
      className,
    ),
    'data-layout': layout,
    'data-slot': 'news-card',
    ...(href ? { href } : {}),
    ...(props as Record<string, unknown>),
  };

  return (
    <Tag {...rootProps}>
      {isHero && image ? (
        <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
          <img src={image.src} alt={image.alt} className="h-full w-full object-cover" />
        </div>
      ) : null}
      <div className={cn('flex flex-1 flex-col gap-2 p-4', isHero && 'p-5')}>
        {source ? (
          <div>
            <Badge variant="outline" className="text-[11px]">
              {source}
            </Badge>
          </div>
        ) : null}
        <h3 className={cn('font-semibold leading-snug', isHero ? 'text-lg' : 'text-sm')}>
          {title}
        </h3>
        {formattedDate ? (
          <div className="text-xs text-muted-foreground">{formattedDate}</div>
        ) : null}
        {excerpt ? <p className="text-sm text-muted-foreground line-clamp-3">{excerpt}</p> : null}
        {tags && tags.length > 0 ? (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
            {tags.map((t) => (
              <Badge key={t} variant="secondary" className="text-[11px]">
                {t}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </Tag>
  );
}
