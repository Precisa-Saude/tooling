import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Locate the bundled `templates/` directory.
 *
 * When published to npm, the templates live at `dist/templates/` inside
 * the CLI package (copied by `scripts/copy-templates.mjs` during build).
 *
 * When running from the monorepo (e.g. `pnpm --filter @precisa-saude/cli dev`),
 * the templates live at the repo root — fall back to walking up from the
 * package directory.
 */
export function resolveTemplatesDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));

  // Published case: cli package's dist/templates
  const bundled = resolve(here, 'templates');
  if (existsSync(bundled)) return bundled;

  // Dev case: walk up from packages/cli/{src|dist} to the monorepo root
  const repoRoot = resolve(here, '..', '..', '..', '..');
  const repoTemplates = resolve(repoRoot, 'templates');
  if (existsSync(repoTemplates)) return repoTemplates;

  // Sibling-in-package case (tsup output): packages/cli/dist -> ../../templates
  const packageParent = resolve(here, '..', '..', 'templates');
  if (existsSync(packageParent)) return packageParent;

  throw new Error(
    `Could not locate templates/ directory. Searched:\n  ${bundled}\n  ${repoTemplates}\n  ${packageParent}`,
  );
}
