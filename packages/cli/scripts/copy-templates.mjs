#!/usr/bin/env node
/**
 * Copies the monorepo-root `templates/` directory into this package's
 * `dist/templates/` so it ships with the published npm package. Invoked by
 * `pnpm build` after tsup finishes.
 *
 * Kept as a plain Node script (no external deps) to avoid pulling anything
 * into the CLI's build-time graph.
 */
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');
const repoRoot = resolve(packageRoot, '..', '..');
const source = resolve(repoRoot, 'templates');
const dest = resolve(packageRoot, 'dist', 'templates');

if (!existsSync(source)) {
  console.error(`templates directory not found at ${source}`);
  process.exit(1);
}

if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });

cpSync(source, dest, { recursive: true });
console.log(`Copied templates: ${source} → ${dest}`);
