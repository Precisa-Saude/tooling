import type { ComponentProps, ReactNode } from 'react';

import { cn } from '../utils/cn.js';

export interface SocialLink {
  /** Target href. */
  href: string;
  /** Icon element (typically a lucide icon). */
  icon: ReactNode;
  /** Display label (used for `aria-label`). */
  label: string;
}

export interface AppStoreBadge {
  /** Alt text (e.g. "Download on the App Store"). */
  alt: string;
  /** Store URL. */
  href: string;
  /** Badge image source. Provide high-DPI-friendly SVG or PNG. */
  src: string;
}

export interface FooterProps extends Omit<ComponentProps<'footer'>, 'children'> {
  /** App store badges (App Store / Play Store) rendered on the right. */
  appStoreBadges?: AppStoreBadge[];
  /** Bottom-line legal/copyright text. */
  legal?: ReactNode;
  /** Secondary link rows (e.g. Privacy, Terms, Licenses). */
  links?: Array<{ label: ReactNode; href: string }>;
  /** Brand logo / wordmark on the left. */
  logo?: ReactNode;
  /** Social links rendered as icon buttons. */
  socials?: SocialLink[];
  /** Application version string (e.g. `'1.18.0'` or `'1.18.0 (c3f5d0681)'`). */
  version?: string;
}

/**
 * Site / app footer with slots for brand, socials, secondary links, app-store
 * badges, version string, and legal copy.
 *
 * The version string renders as a clickable pill that copies itself to the
 * clipboard on click — useful for bug reports.
 */
export function Footer({
  appStoreBadges,
  className,
  legal,
  links,
  logo,
  socials,
  version,
  ...props
}: FooterProps) {
  const onCopyVersion = version
    ? () => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          void navigator.clipboard.writeText(version);
        }
      }
    : undefined;

  return (
    <footer
      data-slot="footer"
      className={cn('w-full border-t bg-card text-card-foreground', className)}
      {...props}
    >
      <div className="mx-auto flex max-w-(--grid-max-w) flex-col gap-6 px-4 py-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row md:items-start">
          {logo ? <div data-slot="footer-logo">{logo}</div> : null}

          {socials && socials.length > 0 ? (
            <nav aria-label="Social" className="flex items-center gap-2">
              {socials.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  aria-label={s.label}
                  className={cn(
                    'inline-flex size-9 items-center justify-center rounded-full text-muted-foreground',
                    'transition-colors hover:bg-muted hover:text-foreground',
                    '[&_svg]:size-4',
                  )}
                >
                  {s.icon}
                </a>
              ))}
            </nav>
          ) : null}

          {appStoreBadges && appStoreBadges.length > 0 ? (
            <div className="flex items-center gap-3" data-slot="footer-app-badges">
              {appStoreBadges.map((b) => (
                <a key={b.href} href={b.href} className="inline-block">
                  <img src={b.src} alt={b.alt} className="h-10 w-auto" />
                </a>
              ))}
            </div>
          ) : null}
        </div>

        {links && links.length > 0 ? (
          <nav
            aria-label="Legal"
            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground"
          >
            {links.map((l, i) => (
              <a key={l.href} href={l.href} className="hover:text-foreground">
                {l.label}
                {i < links.length - 1 ? (
                  <span aria-hidden className="ml-4 text-border">
                    •
                  </span>
                ) : null}
              </a>
            ))}
          </nav>
        ) : null}

        <div className="flex flex-col items-center gap-2 text-center text-xs text-muted-foreground">
          {version ? (
            <button
              type="button"
              onClick={onCopyVersion}
              className="rounded-md px-2 py-0.5 font-mono text-[11px] transition-colors hover:bg-muted"
              title="Copy version"
            >
              v{version}
            </button>
          ) : null}
          {legal ? <p>{legal}</p> : null}
        </div>
      </div>
    </footer>
  );
}
