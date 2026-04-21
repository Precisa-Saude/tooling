import { CheckIcon, CopyIcon } from 'lucide-react';
import { type ComponentProps, useEffect, useRef, useState } from 'react';

import { cn } from '../utils/cn.js';

type ShikiHighlighter = {
  codeToHtml: (code: string, options: { lang: string; theme: string }) => string | Promise<string>;
};

export interface CodeExampleProps extends Omit<ComponentProps<'div'>, 'children' | 'title'> {
  /** Source to render. */
  code: string;
  /** Pre-rendered HTML (e.g. from a build-time Shiki pass). When set, `highlighter` + client-side Shiki are bypassed. */
  highlightedHtml?: string;
  /** Pre-configured Shiki highlighter instance. If omitted, consumers can supply `highlightedHtml` directly. */
  highlighter?: ShikiHighlighter;
  /** Shiki language name (e.g. `typescript`, `tsx`, `bash`, `json`). Default: `typescript`. */
  language?: string;
  /** Whether to show a copy-to-clipboard button. Default: `true`. */
  showCopy?: boolean;
  /** Shiki theme name. Default: `github-dark`. */
  theme?: string;
  /** Optional filename / title shown in the header. */
  title?: string;
}

/**
 * Syntax-highlighted code block with optional copy button.
 *
 * Shiki is an **optional peer dependency**. Consumers can either:
 *
 * - Pass a pre-built highlighter via `highlighter` prop (instantiated once at
 *   app init with the languages + themes they need).
 * - Pass pre-rendered HTML via `highlightedHtml` (ideal for build-time static
 *   generation — no runtime Shiki cost).
 * - Do neither, in which case the code renders as plain text in a styled
 *   `<pre>` block (graceful degradation).
 */
export function CodeExample({
  className,
  code,
  highlightedHtml,
  highlighter,
  language = 'typescript',
  showCopy = true,
  theme = 'github-dark',
  title,
  ...props
}: CodeExampleProps) {
  const [html, setHtml] = useState<string | null>(highlightedHtml ?? null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (highlightedHtml) {
      setHtml(highlightedHtml);
      return;
    }
    if (!highlighter) {
      setHtml(null);
      return;
    }
    let cancelled = false;
    void Promise.resolve(highlighter.codeToHtml(code, { lang: language, theme })).then(
      (rendered) => {
        if (!cancelled) setHtml(rendered);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [code, language, theme, highlighter, highlightedHtml]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  function copy() {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div
      data-slot="code-example"
      className={cn('overflow-hidden rounded-lg border bg-card', className)}
      {...props}
    >
      {(title || showCopy) && (
        <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5">
          <span className="font-mono text-xs text-muted-foreground">{title ?? language}</span>
          {showCopy ? (
            <button
              type="button"
              onClick={copy}
              aria-label={copied ? 'Copied' : 'Copy code'}
              className={cn(
                'inline-flex size-6 items-center justify-center rounded-md text-muted-foreground',
                'transition-colors hover:bg-muted hover:text-foreground',
                '[&_svg]:size-3.5',
              )}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          ) : null}
        </div>
      )}
      {html ? (
        <div
          className="overflow-x-auto text-sm [&>pre]:!m-0 [&>pre]:!bg-transparent [&>pre]:p-4"
          // Shiki output is sanitized source from the highlighter; trusted here.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="overflow-x-auto bg-card p-4 text-sm">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
