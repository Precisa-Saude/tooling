import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type { MergeStrategy, TemplateEntry } from './templates.js';

export type ApplyOutcome =
  | { kind: 'create'; target: string; rendered: string }
  | { kind: 'update'; target: string; previous: string; rendered: string }
  | { kind: 'skip-identical'; target: string }
  | { kind: 'preserve'; target: string; current: string; rendered: string }
  | { kind: 'skip-exists'; target: string }
  | { kind: 'merge-json'; target: string; previous: string; rendered: string }
  | { kind: 'error'; target: string; message: string };

export interface ApplyOptions {
  /** Repo root to apply into. */
  cwd: string;
  /** When true, compute the outcome but do not write to disk. */
  dryRun: boolean;
  /** Template entry being applied. */
  entry: TemplateEntry;
  /** Rendered template content (post token substitution). */
  rendered: string;
}

/**
 * Apply a single template file to the target repo. Returns the outcome
 * so callers can print a per-file status row and, on dry-run, a diff.
 */
export function applyTemplate({ cwd, dryRun, entry, rendered }: ApplyOptions): ApplyOutcome {
  const targetPath = resolve(cwd, entry.target);
  const exists = existsSync(targetPath);

  if (!exists) {
    if (!dryRun) writeFile(targetPath, rendered, entry.executable === true);
    return { kind: 'create', rendered, target: entry.target };
  }

  const current = readFileSync(targetPath, 'utf-8');

  switch (entry.merge_strategy as MergeStrategy) {
    case 'overwrite': {
      if (current === rendered) {
        return { kind: 'skip-identical', target: entry.target };
      }
      if (!dryRun) writeFile(targetPath, rendered, entry.executable === true);
      return { kind: 'update', previous: current, rendered, target: entry.target };
    }
    case 'skip_if_exists': {
      return { kind: 'skip-exists', target: entry.target };
    }
    case 'preserve': {
      return { current, kind: 'preserve', rendered, target: entry.target };
    }
    case 'merge_json': {
      let merged: string;
      try {
        merged = mergeJson(current, rendered);
      } catch (err) {
        return {
          kind: 'error',
          message: `JSON merge failed: ${(err as Error).message}`,
          target: entry.target,
        };
      }
      if (current === merged) {
        return { kind: 'skip-identical', target: entry.target };
      }
      if (!dryRun) writeFile(targetPath, merged, entry.executable === true);
      return { kind: 'merge-json', previous: current, rendered: merged, target: entry.target };
    }
    default: {
      return {
        kind: 'error',
        message: `Unknown merge_strategy '${entry.merge_strategy}'`,
        target: entry.target,
      };
    }
  }
}

function writeFile(path: string, contents: string, executable: boolean): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
  if (executable) chmodSync(path, 0o755);
}

/**
 * Shallow 3-way-ish JSON merge — the current file wins on conflicts so
 * repo-local customizations aren't clobbered. Objects are merged
 * key-by-key; arrays and scalars are replaced entirely by the current
 * value when present (falls back to the template value).
 *
 * If parsing fails, throws so the caller can report the error.
 */
export function mergeJson(currentRaw: string, templateRaw: string): string {
  const current = JSON.parse(currentRaw) as unknown;
  const template = JSON.parse(templateRaw) as unknown;
  const merged = mergeValue(template, current);
  return `${JSON.stringify(merged, null, 2)}\n`;
}

function mergeValue(template: unknown, current: unknown): unknown {
  if (current === undefined) return template;
  if (
    typeof template !== 'object' ||
    template === null ||
    Array.isArray(template) ||
    typeof current !== 'object' ||
    current === null ||
    Array.isArray(current)
  ) {
    // Scalars / arrays: current value wins (never clobber repo-local values).
    return current;
  }
  const out: Record<string, unknown> = {};
  const keys = new Set([
    ...Object.keys(template as Record<string, unknown>),
    ...Object.keys(current as Record<string, unknown>),
  ]);
  for (const k of keys) {
    out[k] = mergeValue(
      (template as Record<string, unknown>)[k],
      (current as Record<string, unknown>)[k],
    );
  }
  return out;
}
