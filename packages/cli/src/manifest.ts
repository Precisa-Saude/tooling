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

  /**
   * Alvos que este repo mantém divergentes de propósito. `doctor` e `sync`
   * pulam cada caminho listado: o doctor não conta como drift e o sync não
   * sobrescreve.
   *
   * Existe porque 39 dos 44 templates são `overwrite` e não havia como
   * declarar customização deliberada — ela virava drift permanente, reportado
   * todo mês, e um `sync` a descartava sem backup nem confirmação. Repos
   * documentavam o fork num comentário no topo do arquivo, que é prosa, não
   * mecanismo.
   *
   * Use com parcimônia e diga por quê: cada entrada é um arquivo que deixa de
   * receber correção upstream. Preferir levar a mudança para o `tooling`
   * quando ela servir a todos os repos.
   *
   * Exemplo: `[".github/workflows/_checks.yml"]` — job de invariante do
   * dataset que não tem equivalente no template.
   */
  ignoreTemplates?: string[];

  /** Repository name (typically matches the GitHub repo name). */
  name: string;

  /** Pinned runtime versions. Default: node=22, pnpm=9.15.9. */
  nodeVersion?: string;

  /** GitHub organization or user that owns the repo (e.g. `Precisa-Saude`). */
  owner: string;

  pnpmVersion?: string;

  /** Publishes any workspace package to npm? */
  publishesToNpm: boolean;

  /**
   * Workspace package directories (relative to repo root) that the
   * `publish` job in `ci.yml` should pass to `_publish.yml`. Only read
   * when `publishesToNpm: true`. Example: `["packages/core", "packages/cli"]`.
   */
  publishPackages?: string[];

  /** Schema version of this manifest file. Bump when the schema changes. */
  schemaVersion: 1;

  /**
   * pnpm filter selector for the site package, passed to the deploy
   * workflow. Only read when `hasSite: true`. Example: `@my-repo/site`.
   */
  siteFilter?: string;

  /**
   * Cloudflare Pages project name for the deploy-site workflow. Only
   * read when `hasSite: true`.
   */
  siteProjectName?: string;

  /**
   * Path prefix(es) (relative to repo root, trailing slash) treated as site
   * source for change detection in `_deploy-site.yml`. Defaults to
   * `site/` — override to `packages/site/` for monorepos where the site
   * lives under `packages/`.
   *
   * Aceita lista quando o site é montado a partir de mais de um diretório.
   * Em medbench-brasil o leaderboard vem de `results/` via `import.meta.glob`:
   * uma PR que só adiciona modelos muda o site sem tocar em `site/`, e com
   * prefixo único o deploy era pulado em silêncio, com o CI verde. Declare
   * todo diretório que o site lê — `['site/', 'results/']`.
   */
  siteSourcePath?: string | string[];

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
  | 'never'
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
    case 'never':
      return false;
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
/**
 * `siteSourcePath` aceita string ou lista; o workflow recebe sempre uma string
 * separada por vírgula e faz o split. Manter a normalização aqui evita que o
 * template precise saber de qual das duas formas o manifesto veio.
 */
function normalizeSourcePaths(value: string | string[] | undefined): string {
  if (value === undefined) return 'site/';
  return (Array.isArray(value) ? value : [value])
    .map((p) => p.trim())
    .filter(Boolean)
    .join(',');
}

/** true quando o repo declarou este alvo como divergência deliberada. */
export function isIgnored(target: string, manifest: PrecisaManifest): boolean {
  return (manifest.ignoreTemplates ?? []).some((t) => t.trim() === target);
}

export function tokenContext(manifest: PrecisaManifest): Record<string, string> {
  return {
    COMMIT_SCOPES: manifest.commitScopes.join(','),
    // For human-readable docs (AGENTS.md, README) — backticked list.
    COMMIT_SCOPES_HUMAN: manifest.commitScopes.map((s) => `\`${s}\``).join(', '),
    // For `.commitlintrc.cjs` — scope array spelled as JS string literals,
    // ready to drop inside `[ ... ]`.
    COMMIT_SCOPES_JSON: manifest.commitScopes.map((s) => `'${s}'`).join(', '),
    CONDUCT_EMAIL: manifest.contactEmails.conduct,
    HAS_PACKAGES: String(manifest.hasPackages),
    HAS_SITE: String(manifest.hasSite),
    NODE_VERSION: manifest.nodeVersion ?? '22',
    OWNER_ORG: manifest.owner,
    PNPM_VERSION: manifest.pnpmVersion ?? '9.15.9',
    // YAML block-scalar body for the `packages: |` input of `_publish.yml`.
    // The template provides the first entry's indent; subsequent entries
    // get 8 spaces explicitly to match. Empty when no packages declared.
    PUBLISH_PACKAGES_YAML: (manifest.publishPackages ?? []).join('\n        '),
    PUBLISHES_TO_NPM: String(manifest.publishesToNpm),
    REPO_NAME: manifest.name,
    REPO_SLUG: `${manifest.owner}/${manifest.name}`,
    SECURITY_EMAIL: manifest.contactEmails.security,
    SITE_FILTER: manifest.siteFilter ?? '',
    SITE_PROJECT_NAME: manifest.siteProjectName ?? '',
    // Lista vira string separada por vírgula — o workflow faz o split.
    SITE_SOURCE_PATH: normalizeSourcePaths(manifest.siteSourcePath),
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
  if (m.ignoreTemplates !== undefined) {
    if (!Array.isArray(m.ignoreTemplates)) {
      errors.push({ message: 'must be an array of strings', path: 'ignoreTemplates' });
    } else if (m.ignoreTemplates.some((t) => typeof t !== 'string' || !t.trim())) {
      errors.push({ message: 'entries must be non-empty strings', path: 'ignoreTemplates' });
    }
  }
  if (m.publishPackages !== undefined) {
    if (!Array.isArray(m.publishPackages)) {
      errors.push({ message: 'must be an array of strings', path: 'publishPackages' });
    } else if (m.publishPackages.some((p) => typeof p !== 'string' || !p)) {
      errors.push({ message: 'entries must be non-empty strings', path: 'publishPackages' });
    }
  }
  if (m.publishesToNpm) {
    if (!Array.isArray(m.publishPackages) || m.publishPackages.length === 0) {
      errors.push({
        message: 'must have at least one entry when publishesToNpm is true',
        path: 'publishPackages',
      });
    }
  }
  if (m.hasSite === true) {
    for (const key of ['siteProjectName', 'siteFilter'] as const) {
      if (typeof m[key] !== 'string' || !m[key]) {
        errors.push({ message: 'required and non-empty when hasSite is true', path: key });
      }
    }
  }
  if (m.siteProjectName !== undefined && typeof m.siteProjectName !== 'string') {
    errors.push({ message: 'must be a string', path: 'siteProjectName' });
  }
  if (m.siteFilter !== undefined && typeof m.siteFilter !== 'string') {
    errors.push({ message: 'must be a string', path: 'siteFilter' });
  }
  if (m.siteSourcePath !== undefined) {
    const v = m.siteSourcePath;
    // String vazia precisa ser rejeitada: ela normaliza para lista vazia, e
    // uma lista vazia faz o predicado do workflow (`some`) devolver sempre
    // false — o site nunca mais é publicado, em silêncio e com o CI verde.
    const stringValida = typeof v === 'string' && v.trim().length > 0;
    const listaValida =
      Array.isArray(v) &&
      v.length > 0 &&
      v.every((p) => typeof p === 'string' && p.trim().length > 0);
    if (!stringValida && !listaValida) {
      errors.push({
        message: 'must be a non-empty string or a non-empty array of non-empty strings',
        path: 'siteSourcePath',
      });
    }
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
