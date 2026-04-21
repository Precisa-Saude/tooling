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

  /** Does this repo have publishable packages/* ? */
  hasPackages: boolean;

  /** Does this repo ship a website? */
  hasSite: boolean;

  /** Pinned runtime versions. Default: node=22, pnpm=9.15.9. */
  nodeVersion?: string;

  pnpmVersion?: string;

  /** Publishes any workspace package to npm? */
  publishesToNpm: boolean;

  /** Schema version of this manifest file itself. Bump when the schema changes. */
  schemaVersion: 1;

  /** OSS-public or private-internal. Controls which templates are rendered. */
  visibility: 'oss' | 'private';
}

export const DEFAULT_MANIFEST: Omit<PrecisaManifest, 'commitScopes' | 'contactEmails'> = {
  hasPackages: true,
  hasSite: false,
  nodeVersion: '22',
  pnpmVersion: '9.15.9',
  publishesToNpm: true,
  schemaVersion: 1,
  visibility: 'oss',
};
