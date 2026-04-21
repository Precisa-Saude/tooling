import type { ComponentProps, ReactNode } from 'react';

import { cn } from '../utils/cn.js';

export interface HeroProps extends Omit<ComponentProps<'section'>, 'children' | 'title'> {
  /** Alignment of the text block. Default: `start`. */
  align?: 'start' | 'center';
  /** Eyebrow label rendered above the title (e.g. product category, feature tag). */
  eyebrow?: ReactNode;
  /** Primary CTA (typically a `<Button>` element). */
  primaryCta?: ReactNode;
  /** Secondary CTA / link. */
  secondaryCta?: ReactNode;
  /** Side content (image, illustration, decorative element). Rendered at right on desktop, below text on mobile. */
  side?: ReactNode;
  /** Sub-title / lede paragraph. */
  subtitle?: ReactNode;
  /** Main headline. */
  title: ReactNode;
}

/**
 * Hero section scaffold. Pure layout shell — consumers bring their own
 * background (e.g. wrap with `MosaicBg`) and CTAs.
 *
 * Two-column on desktop when `side` is set; single-column otherwise.
 * Follows the shared 14/16-col grid when mounted inside a `PageContainer`.
 */
export function Hero({
  align = 'start',
  className,
  eyebrow,
  primaryCta,
  secondaryCta,
  side,
  subtitle,
  title,
  ...props
}: HeroProps) {
  const alignClasses = align === 'center' ? 'text-center items-center' : 'text-left items-start';

  return (
    <section
      data-slot="hero"
      data-align={align}
      className={cn(
        'flex flex-col gap-10 py-16 md:py-24',
        side && 'md:grid md:grid-cols-2 md:gap-16',
        className,
      )}
      {...props}
    >
      <div className={cn('flex flex-col gap-4', alignClasses)}>
        {eyebrow ? (
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-0.5 text-xs font-medium text-muted-foreground">
            {eyebrow}
          </span>
        ) : null}
        <h1 className="text-balance text-4xl font-semibold leading-tight md:text-5xl lg:text-6xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="max-w-prose text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
            {subtitle}
          </p>
        ) : null}
        {(primaryCta || secondaryCta) && (
          <div
            className={cn(
              'mt-2 flex flex-wrap gap-3',
              align === 'center' ? 'justify-center' : 'justify-start',
            )}
          >
            {primaryCta}
            {secondaryCta}
          </div>
        )}
      </div>
      {side ? (
        <div data-slot="hero-side" className="flex items-center justify-center">
          {side}
        </div>
      ) : null}
    </section>
  );
}
