import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parse as parseYaml } from 'yaml';

import type { RequiredWhen } from '../manifest.js';
import { resolveTemplatesDir } from './paths.js';

export type MergeStrategy = 'overwrite' | 'merge_json' | 'preserve' | 'skip_if_exists';

export interface TemplateEntry {
  /** Whether to mark the rendered file executable (chmod +x). */
  executable?: boolean;
  /** How to merge when the target already exists. */
  merge_strategy: MergeStrategy;
  /** Gate for inclusion. */
  required_when: RequiredWhen;
  /** Path relative to templates/. */
  source: string;
  /** Path in the target repo (relative to the repo root). */
  target: string;
}

interface TemplateManifestFile {
  templates: TemplateEntry[];
}

/**
 * Load the `templates.manifest.yml` from the bundled templates directory.
 * Throws if the file is missing or the shape is wrong.
 */
export function loadTemplateManifest(): TemplateEntry[] {
  const dir = resolveTemplatesDir();
  const manifestPath = resolve(dir, 'templates.manifest.yml');
  const raw = readFileSync(manifestPath, 'utf-8');
  const parsed = parseYaml(raw) as TemplateManifestFile | undefined;
  if (!parsed || !Array.isArray(parsed.templates)) {
    throw new Error(`${manifestPath}: expected { templates: [...] } at root`);
  }
  for (const [i, t] of parsed.templates.entries()) {
    if (!t.source || !t.target) {
      throw new Error(`${manifestPath}: entry ${i} is missing source or target`);
    }
  }
  return parsed.templates;
}

export function readTemplateSource(entry: TemplateEntry): string {
  const dir = resolveTemplatesDir();
  const path = resolve(dir, entry.source);
  return readFileSync(path, 'utf-8');
}

/**
 * Substitute `{{TOKEN}}` placeholders with values from `context`. Unknown
 * tokens are left untouched (keeps the double braces visible so bad keys
 * are easy to spot in rendered output).
 *
 * Also processes conditional blocks:
 *
 *     {{#if HAS_SITE}}
 *     ...lines rendered only when HAS_SITE is truthy...
 *     {{/if}}
 *
 * Markers can appear inside a host-language comment so the template stays
 * parseable by syntax-aware tools (prettier on YAML, for example):
 *
 *     # {{#if HAS_SITE}}
 *     ...
 *     # {{/if}}
 *
 * A token is "truthy" when its string value is non-empty and not `"false"`.
 * Blocks may nest; they are expanded before token substitution so a block's
 * body can itself reference tokens.
 */
export function renderTokens(source: string, context: Record<string, string>): string {
  return renderTokenSubstitutions(renderConditionalBlocks(source, context), context);
}

function renderTokenSubstitutions(source: string, context: Record<string, string>): string {
  return source.replace(/\{\{([A-Z_]+)\}\}/g, (match, token: string) => {
    return Object.prototype.hasOwnProperty.call(context, token) ? context[token]! : match;
  });
}

function renderConditionalBlocks(source: string, context: Record<string, string>): string {
  // Match an entire line containing `{{#if TOKEN}}` (possibly wrapped in a
  // host-language comment like `# {{#if TOKEN}}` or `// {{#if TOKEN}}`),
  // up through the matching `{{/if}}` line. The whole marker line is
  // consumed so commented-out markers don't leak into rendered output.
  const pattern =
    /^[ \t]*[^\S\n]*[^\n]*\{\{#if ([A-Z_]+)\}\}[^\n]*\n([\s\S]*?)^[ \t]*[^\n]*\{\{\/if\}\}[^\n]*\n?/gm;
  let prev: string;
  let out = source;
  // Re-run to handle nested blocks. Simple fixed-point loop keeps the
  // replacement rules uniform.
  do {
    prev = out;
    out = out.replace(pattern, (_match, token: string, body: string) => {
      const value = context[token];
      const truthy = value !== undefined && value !== '' && value !== 'false';
      return truthy ? body : '';
    });
  } while (out !== prev);
  return out;
}
