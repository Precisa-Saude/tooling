import type { ComponentProps, ReactNode } from 'react';

import { cn } from '../utils/cn.js';

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
  /** GitHub repository URL (rendered as a social icon). */
  githubUrl: string;
  /** "Maintained by" label. Default: "Mantido por". */
  maintainedByLabel?: ReactNode;
  /**
   * Optional npm package or org URL (rendered as a social icon when set).
   * Omit for projects that don't publish to npm yet.
   */
  npmUrl?: string;
}

/**
 * Footer for the OSS sites (fhir-brasil, medbench-brasil, datasus-brasil).
 *
 * Layout: "Mantido por <brand>" on the left + GitHub (and optional npm)
 * social icons on the right, with a thin divider + a shared medical
 * disclaimer paragraph below. Icons and disclaimer are intentionally
 * baked in — they're identical across the OSS sites — so consumers only
 * supply their brand and the per-project repo / npm URLs.
 */
export function OpenFooter({
  brand,
  className,
  githubUrl,
  maintainedByLabel = 'Mantido por',
  npmUrl,
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

            <nav aria-label="Social" className="flex items-center gap-3">
              <SocialLink href={githubUrl} label="GitHub">
                <GitHubIcon />
              </SocialLink>
              {npmUrl ? (
                <SocialLink href={npmUrl} label="npm">
                  <NpmIcon />
                </SocialLink>
              ) : null}
            </nav>
          </div>

          <p className="mt-8 border-t border-ps-violet-dark/10 pt-6 text-justify font-margem text-xs leading-relaxed text-ps-violet-dark/30 [text-align-last:left]">
            {DISCLAIMER}
          </p>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({
  children,
  href,
  label,
}: {
  children: ReactNode;
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-ps-violet-dark/5 text-ps-violet-dark/50 transition-colors hover:bg-ps-violet-dark/10 hover:text-ps-violet-dark"
    >
      {children}
    </a>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  );
}

function NpmIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
      <path d="M0 7.334v8h6.666v1.332H12v-1.332h12v-8H0Zm6.666 6.664H5.334v-4H3.999v4H1.335V8.667h5.331v5.331Zm4 0h-2.666V8.667h5.334v5.331h-2.668v-4h-1.332v4h1.332Zm10.668 0h-1.332v-4h-1.334v4h-1.332v-4h-1.334v4h-2.668V8.667h8.002v5.331h-.002Z" />
    </svg>
  );
}

const DISCLAIMER =
  'Este software é fornecido exclusivamente para fins informativos, de pesquisa e educacionais. Não constitui aconselhamento médico, diagnóstico ou recomendação de tratamento. Os resultados aqui apresentados não substituem a avaliação de um profissional de saúde qualificado. Consulte sempre um profissional de saúde antes de tomar decisões clínicas.';
