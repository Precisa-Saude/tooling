import type { ComponentProps, ReactNode } from 'react';

import { cn } from '../utils/cn.js';

export interface OpenFooterSocial {
  /** Target href. */
  href: string;
  /** Icon element (typically an inline SVG or lucide icon). */
  icon: ReactNode;
  /** Accessible label for the link. */
  label: string;
}

export interface OpenFooterBrand {
  /** URL the logo + wordmark link to. */
  href: string;
  /** Logo element (SVG/image). */
  logo: ReactNode;
  /** Wordmark rendered next to the logo. */
  name: ReactNode;
}

export interface OpenFooterProps extends Omit<ComponentProps<'footer'>, 'children'> {
  /** "Maintained by" brand block on the left. */
  brand: OpenFooterBrand;
  /** Disclaimer / legal paragraph rendered at the bottom. */
  disclaimer: ReactNode;
  /** "Maintained by" label. Default: "Mantido por". */
  maintainedByLabel?: ReactNode;
  /** Social links rendered on the right as round icon buttons. */
  socials?: OpenFooterSocial[];
}

/**
 * Footer for the OSS sites (fhir-brasil, medbench-brasil, datasus-brasil).
 *
 * Layout: "Mantido por <brand>" on the left + social icon row on the
 * right, with a thin divider + full-width disclaimer paragraph below.
 * All copy is consumer-provided — the component ships the structure,
 * typography and spacing conventions only.
 */
export function OpenFooter({
  brand,
  className,
  disclaimer,
  maintainedByLabel = 'Mantido por',
  socials,
  ...props
}: OpenFooterProps) {
  return (
    <footer
      data-slot="open-footer"
      className={cn(
        'border-t border-ps-violet-dark/10 bg-ps-sand/50 transition-colors duration-200',
        className,
      )}
      {...props}
    >
      <div
        className="mx-auto grid gap-4 px-4 py-10 md:px-0"
        style={{
          gridTemplateColumns: 'repeat(var(--grid-cols), 1fr)',
          maxWidth: 'var(--grid-max-w)',
          width: '100%',
        }}
      >
        <div className="col-span-full md:col-span-12 md:col-start-2 3xl:col-start-3">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            <div className="flex flex-col items-center gap-2 sm:items-start">
              <span className="font-margem text-xs tracking-wide text-ps-violet-dark/40">
                {maintainedByLabel}
              </span>
              <a
                href={brand.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center transition-opacity hover:opacity-80"
              >
                {brand.logo}
                <span className="font-pausa text-xl text-ps-violet-light">{brand.name}</span>
              </a>
            </div>

            {socials && socials.length > 0 ? (
              <nav aria-label="Social" className="flex items-center gap-3">
                {socials.map((s) => (
                  <a
                    key={s.href}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-ps-violet-dark/5 text-ps-violet-dark/50 transition-colors hover:bg-ps-violet-dark/10 hover:text-ps-violet-dark"
                  >
                    {s.icon}
                  </a>
                ))}
              </nav>
            ) : null}
          </div>

          <p className="mt-8 border-t border-ps-violet-dark/10 pt-6 text-justify font-margem text-xs leading-relaxed text-ps-violet-dark/30 [text-align-last:left]">
            {disclaimer}
          </p>
        </div>
      </div>
    </footer>
  );
}
