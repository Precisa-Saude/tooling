import { execSync } from 'node:child_process';
import { basename, dirname, resolve } from 'node:path';

import type { ServiceConfig, WorktreeConfig } from './config.js';

/** Convert a branch name to a safe directory-suffix: `feat/foo` → `feat-foo`. */
export function branchToSuffix(branch: string): string {
  return branch.replace(/\//g, '-');
}

export function worktreeDirectoryName(cfg: WorktreeConfig, branch: string): string {
  return `${cfg.directoryPrefix}-${branchToSuffix(branch)}`;
}

export function worktreePath(cfg: WorktreeConfig, repoRoot: string, branch: string): string {
  const parentDir = dirname(repoRoot);
  return resolve(parentDir, worktreeDirectoryName(cfg, branch));
}

export function logFile(svc: ServiceConfig, branch: string): string {
  return `/tmp/${svc.logPrefix}-${branchToSuffix(branch)}.log`;
}

/**
 * Detect the current branch when invoked from inside a linked worktree.
 * Returns null from the main worktree — refusing auto-detect there avoids
 * accidentally acting on `main` when the user forgot to pass a branch.
 */
export function detectBranch(cfg: WorktreeConfig): string | null {
  const cwdBase = basename(process.cwd());
  if (!cwdBase.startsWith(`${cfg.directoryPrefix}-`)) return null;
  try {
    const out = execSync('git branch --show-current', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    return out || null;
  } catch {
    return null;
  }
}

/**
 * Resolve the repo root by walking up from cwd looking for a `package.json`
 * with a `worktree` field. If invoked from inside a linked worktree, falls
 * back to the main worktree (identified by the directory NOT having the
 * `<prefix>-<branch>` suffix).
 */
export function findRepoRoot(): string {
  // `git rev-parse --show-toplevel` gives the worktree root (linked or main).
  try {
    return execSync('git rev-parse --show-toplevel', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return process.cwd();
  }
}

/**
 * From a linked worktree, walk back to the main worktree using
 * `git worktree list --porcelain`. The first entry is always the main.
 */
export function mainWorktreeRoot(): string {
  try {
    const out = execSync('git worktree list --porcelain', {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString();
    const firstLine = out.split('\n')[0] ?? '';
    const match = firstLine.match(/^worktree (.+)$/);
    if (match) return match[1]!;
  } catch {
    // fall through
  }
  return findRepoRoot();
}
