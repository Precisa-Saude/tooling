import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * `.precisa.json` manifest — sits at the root of every consumer repo and
 * declares the repo's profile so `precisa sync` and `precisa doctor` know
 * which templates to render and which rules to enforce.
 */
export interface PrecisaManifest {
  /** Commitlint scope enum for this repo. */
  commitScopes: string[];

  /** Contact emails used in governance doc templates. */
  contactEmails: {
    security: string;
    conduct: string;
  };

  /** Does this repo have publishable packages/*? */
  hasPackages: boolean;

  /** Does this repo ship a website? Controls preview-deploy workflows. */
  hasSite: boolean;

  /** Repository name (typically matches the GitHub repo name). */
  name: string;

  /** Pinned runtime versions. Default: node=22, pnpm=9.15.9. */
  nodeVersion?: string;

  /** GitHub organization or user that owns the repo (e.g. `Precisa-Saude`). */
  owner: string;

  pnpmVersion?: string;

  /** Publishes any workspace package to npm? */
  publishesToNpm: boolean;

  /** Schema version of this manifest file. Bump when the schema changes. */
  schemaVersion: 1;
  /** Public-OSS or private-internal. Controls which templates are rendered. */
  visibility: 'oss' | 'private';
}

export const MANIFEST_FILENAME = '.precisa.json';

export const DEFAULT_MANIFEST_FIELDS = {
  hasPackages: true,
  hasSite: false,
  nodeVersion: '22',
  pnpmVersion: '9.15.9',
  publishesToNpm: true,
  schemaVersion: 1 as const,
  visibility: 'oss' as const,
};

/** Template gate values — `required_when` in templates.manifest.yml. */
export type RequiredWhen =
  | 'always'
  | 'oss'
  | 'private'
  | 'has_site'
  | 'has_packages'
  | 'publishes_to_npm';

/** Returns true when a template's `required_when` gate applies to this manifest. */
export function isRequired(when: RequiredWhen, manifest: PrecisaManifest): boolean {
  switch (when) {
    case 'always':
      return true;
    case 'oss':
      return manifest.visibility === 'oss';
    case 'private':
      return manifest.visibility === 'private';
    case 'has_site':
      return manifest.hasSite;
    case 'has_packages':
      return manifest.hasPackages;
    case 'publishes_to_npm':
      return manifest.publishesToNpm;
    default:
      return true;
  }
}

/**
 * Build the token substitution map from a manifest. Keys are `{{TOKEN}}`
 * (without braces); values are always strings.
 */
export function tokenContext(manifest: PrecisaManifest): Record<string, string> {
  return {
    COMMIT_SCOPES: manifest.commitScopes.join(','),
    CONDUCT_EMAIL: manifest.contactEmails.conduct,
    HAS_PACKAGES: String(manifest.hasPackages),
    HAS_SITE: String(manifest.hasSite),
    NODE_VERSION: manifest.nodeVersion ?? '22',
    OWNER_ORG: manifest.owner,
    PNPM_VERSION: manifest.pnpmVersion ?? '9.15.9',
    PUBLISHES_TO_NPM: String(manifest.publishesToNpm),
    REPO_NAME: manifest.name,
    REPO_SLUG: `${manifest.owner}/${manifest.name}`,
    SECURITY_EMAIL: manifest.contactEmails.security,
    VISIBILITY: manifest.visibility,
  };
}

export interface ManifestValidationError {
  message: string;
  path: string;
}

export function validateManifest(raw: unknown): ManifestValidationError[] {
  const errors: ManifestValidationError[] = [];
  const m = raw as Partial<PrecisaManifest> | undefined;
  if (!m || typeof m !== 'object') {
    return [{ message: 'manifest must be a JSON object', path: '$' }];
  }
  if (m.schemaVersion !== 1) {
    errors.push({ message: 'must be 1', path: 'schemaVersion' });
  }
  if (typeof m.name !== 'string' || !m.name) {
    errors.push({ message: 'must be a non-empty string', path: 'name' });
  }
  if (typeof m.owner !== 'string' || !m.owner) {
    errors.push({ message: 'must be a non-empty string', path: 'owner' });
  }
  if (m.visibility !== 'oss' && m.visibility !== 'private') {
    errors.push({ message: "must be 'oss' or 'private'", path: 'visibility' });
  }
  for (const key of ['hasSite', 'hasPackages', 'publishesToNpm'] as const) {
    if (typeof m[key] !== 'boolean') {
      errors.push({ message: 'must be a boolean', path: key });
    }
  }
  if (!Array.isArray(m.commitScopes)) {
    errors.push({ message: 'must be an array of strings', path: 'commitScopes' });
  }
  if (!m.contactEmails || typeof m.contactEmails !== 'object') {
    errors.push({ message: 'must be an object', path: 'contactEmails' });
  } else {
    for (const key of ['security', 'conduct'] as const) {
      if (typeof m.contactEmails[key] !== 'string' || !m.contactEmails[key]) {
        errors.push({
          message: 'must be a non-empty string',
          path: `contactEmails.${key}`,
        });
      }
    }
  }
  return errors;
}

export function loadManifest(cwd: string): PrecisaManifest {
  const path = resolve(cwd, MANIFEST_FILENAME);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    throw new Error(`Failed to read ${MANIFEST_FILENAME} at ${path}: ${(err as Error).message}`);
  }
  const errors = validateManifest(raw);
  if (errors.length > 0) {
    const detail = errors.map((e) => `  - ${e.path}: ${e.message}`).join('\n');
    throw new Error(`Invalid ${MANIFEST_FILENAME}:\n${detail}`);
  }
  return raw as PrecisaManifest;
}

export function writeManifest(cwd: string, manifest: PrecisaManifest): void {
  const path = resolve(cwd, MANIFEST_FILENAME);
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}
