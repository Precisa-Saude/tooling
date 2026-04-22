import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface ServiceConfig {
  /**
   * Extra args passed to the dev script. `{port}` is replaced with the
   * allocated port. Defaults to `['--port', '{port}']` (works with vite).
   */
  devArgs?: string[];
  /**
   * Optional: additional env vars to set for the dev process. The literal
   * `{port}` is substituted. Example: `{ VITE_API_URL: 'http://localhost:{port}/api' }`.
   */
  env?: Record<string, string>;
  /**
   * First port for feature worktrees. Slot 1 uses this port; slot 2 uses
   * `featureBase + increment`, slot 3 uses `featureBase + 2*increment`, etc.
   */
  featureBase: number;
  /** Increment between slots. Defaults to 10. */
  increment?: number;
  /**
   * Prefix for the log file path: `/tmp/<logPrefix>-<branch>.log`. Required
   * so that sibling services in a repo don't overwrite each other's logs.
   */
  logPrefix: string;
  /** Port used by the default (main) worktree. */
  mainPort: number;
  /** Service name used in CLI output, column headers, and log file naming. */
  name: string;
  /** pnpm filter pattern for `worktree dev`. Example: `@medbench-brasil/site`. */
  pnpmFilter: string;
}

export interface WorktreeConfig {
  /**
   * Optional extra build command run during `setup`, after `pnpm install`.
   * Example: `pnpm turbo run build --filter=./packages/*`.
   */
  buildCommand?: string;
  /**
   * Prefix used for worktree directory names: `<prefix>-<branch>`.
   * Example: `medbench-brasil` → worktrees land at
   * `../medbench-brasil-feat-foo`.
   */
  directoryPrefix: string;
  /**
   * Whether to run `pnpm install` during setup. Defaults to true. Set to
   * false for repos where install should be manual or where the script
   * is invoked inside a container.
   */
  install?: boolean;
  /** Absolute path to the lock directory. Defaults to `<portRegistry>.lock.d`. */
  portLockDir?: string;
  /** Absolute path to the port registry JSON file. */
  portRegistry: string;
  /** Services managed by this repo. At least one required. */
  services: ServiceConfig[];
  /**
   * Extra per-service file writes performed during `setup`, after
   * install + build. Intended for repos that need `.env.local`-style
   * files seeded with the allocated ports so that running `dev` without
   * explicit env vars picks up the right values.
   *
   * Each entry is `{ path, contents }` where `contents` supports the
   * same `{port}` and `{<service>_port}` substitutions available in
   * `service.env` / `service.devArgs`.
   *
   * Example (platform):
   *   writeFiles: [
   *     { path: 'apps/web/.env.local',
   *       contents: 'VITE_DEV_PORT={web_port}\nVITE_API_URL=http://localhost:{api_port}/api\n' },
   *     { path: 'apps/api/.env.local',
   *       contents: 'PORT={api_port}\n' },
   *   ]
   */
  writeFiles?: Array<{ path: string; contents: string }>;
}

interface PackageJson {
  name?: string;
  worktree?: WorktreeConfig;
}

export async function loadConfig(repoRoot: string): Promise<WorktreeConfig> {
  const pkgPath = resolve(repoRoot, 'package.json');
  let pkg: PackageJson;
  try {
    pkg = JSON.parse(await readFile(pkgPath, 'utf-8')) as PackageJson;
  } catch (err) {
    throw new Error(`Failed to read ${pkgPath}: ${(err as Error).message}. Is this the repo root?`);
  }

  const cfg = pkg.worktree;
  if (!cfg) {
    throw new Error(
      `No "worktree" field in ${pkgPath}. Add a worktree config — see ` +
        `https://github.com/Precisa-Saude/tooling/tree/main/packages/worktree-cli#configuration`,
    );
  }

  if (!cfg.directoryPrefix) {
    throw new Error('worktree.directoryPrefix is required');
  }
  if (!cfg.portRegistry) {
    throw new Error('worktree.portRegistry is required');
  }
  if (!cfg.services?.length) {
    throw new Error('worktree.services must contain at least one entry');
  }
  for (const svc of cfg.services) {
    if (!svc.name) throw new Error('service.name is required');
    if (!svc.pnpmFilter) throw new Error(`service.${svc.name}.pnpmFilter is required`);
    if (!svc.logPrefix) throw new Error(`service.${svc.name}.logPrefix is required`);
    if (typeof svc.mainPort !== 'number') {
      throw new Error(`service.${svc.name}.mainPort must be a number`);
    }
    if (typeof svc.featureBase !== 'number') {
      throw new Error(`service.${svc.name}.featureBase must be a number`);
    }
  }

  return cfg;
}

export function lockDir(cfg: WorktreeConfig): string {
  return cfg.portLockDir ?? `${cfg.portRegistry}.lock.d`;
}

export function increment(svc: ServiceConfig): number {
  return svc.increment ?? 10;
}

export function devArgs(svc: ServiceConfig): string[] {
  return svc.devArgs ?? ['--port', '{port}'];
}
