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
 */
export function renderTokens(source: string, context: Record<string, string>): string {
  return source.replace(/\{\{([A-Z_]+)\}\}/g, (match, token: string) => {
    return Object.prototype.hasOwnProperty.call(context, token) ? context[token]! : match;
  });
}
