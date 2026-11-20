import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { join } from 'node:path';

export const DAY_MS = 86_400_000;

/** Days without activity after which an unfinished branch is archived and removed. */
export const DEFAULT_STALE_DAYS = 7;

/** Large enough for `git status` of a busy worktree; the default is 1 MiB. */
const MAX_BUFFER = 64 * 1024 * 1024;

/** `YYYY-MM-DD` in local time, used in archive tag names and directories. */
export function archiveDate(now: number): string {
  const d = new Date(now);
  const two = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/** Whole days between `lastActivity` and `now`, never negative. */
export function idleDays(now: number, lastActivity: number): number {
  return Math.floor(Math.max(0, now - lastActivity) / DAY_MS);
}

export function isStale(now: number, lastActivity: number, staleDays: number): boolean {
  return now - lastActivity > staleDays * DAY_MS;
}

/**
 * Paths listed by `git status --porcelain -z`. A rename or copy carries its
 * source path as the next NUL-separated entry, which is skipped.
 */
export function parseStatusPaths(z: string): string[] {
  const paths: string[] = [];
  const entries = z.split('\0');
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i] ?? '';
    if (entry.length < 4) continue;
    const xy = entry.slice(0, 2);
    paths.push(entry.slice(3));
    if (xy.includes('R') || xy.includes('C')) i++;
  }
  return paths;
}

/**
 * Last activity on a local branch, in epoch ms: the newest of the tip's
 * committer date, the branch's last reflog entry (creation, reset, pull)
 * and the mtime of each file with uncommitted changes in its worktree.
 */
export function branchActivity(
  mainRoot: string,
  branch: string,
  tipTimeMs: number,
  worktree?: string,
): number {
  let newest = tipTimeMs;
  try {
    const gd = run('git', [
      '-C',
      mainRoot,
      'log',
      '-g',
      '-n',
      '1',
      '--date=unix',
      '--format=%gd',
      `refs/heads/${branch}`,
    ]);
    const seconds = /@\{(\d+)\}/.exec(gd)?.[1];
    if (seconds) newest = Math.max(newest, Number(seconds) * 1000);
  } catch {
    // no reflog for this branch
  }
  return worktree ? Math.max(newest, uncommittedActivity(worktree)) : newest;
}

/**
 * Last activity in a detached worktree, in epoch ms: the newest of the HEAD
 * commit's date, the worktree's own HEAD, index and reflog files (checkout,
 * reset, status) and the mtime of each file with uncommitted changes. The HEAD
 * commit alone would make a worktree just created on an old commit look idle.
 */
export function detachedActivity(worktree: string): number {
  let newest = 0;
  try {
    newest =
      Number(run('git', ['-C', worktree, 'log', '-1', '--format=%ct', 'HEAD']).trim()) * 1000;
    const gitDir = run('git', ['-C', worktree, 'rev-parse', '--absolute-git-dir']).trim();
    for (const f of ['HEAD', 'index', join('logs', 'HEAD')]) {
      try {
        newest = Math.max(newest, statSync(join(gitDir, f)).mtimeMs);
      } catch {
        // file absent
      }
    }
  } catch {
    // unreadable: rely on the files below
  }
  return Math.max(newest, uncommittedActivity(worktree));
}

/** Newest mtime among the files with uncommitted changes in `worktree`, or 0. */
function uncommittedActivity(worktree: string): number {
  let newest = 0;
  let status: string;
  try {
    status = run('git', ['-C', worktree, 'status', '--porcelain', '-z', '-uall']);
  } catch {
    return newest;
  }
  for (const rel of parseStatusPaths(status)) {
    try {
      newest = Math.max(newest, statSync(join(worktree, rel)).mtimeMs);
    } catch {
      // deleted file: no mtime
    }
  }
  return newest;
}

export interface ArchiveRequest {
  branch: string;
  /** `YYYY-MM-DD`, from `archiveDate`. */
  date: string;
  /** Runs git in the main checkout. */
  git: (args: string[]) => string;
  reason: string;
  /** Start of the tag message. Defaults to `Branch <branch> arquivada`. */
  subject?: string;
  tip: string;
}

export interface ArchiveResult {
  tag: string;
}

export function archiveTag(date: string, branch: string): string {
  return `archive/${date}/${branch}`;
}

/** `archive/<date>/<branch>` annotated tag at the tip; message mandatory under tag.gpgSign. */
export function tagArchive(
  git: (args: string[]) => string,
  tag: string,
  tip: string,
  message: string,
): void {
  git(['tag', '-f', '-m', message, tag, tip]);
}

/**
 * Save what removing the branch would lose: an annotated tag at the tip. Only
 * clean worktrees get here (prune keeps any worktree with uncommitted
 * changes), so the tip is everything. Throws on failure; the caller then
 * deletes nothing.
 */
export function archiveBranch(req: ArchiveRequest): ArchiveResult {
  const tag = archiveTag(req.date, req.branch);
  tagArchive(
    req.git,
    tag,
    req.tip,
    `${req.subject ?? `Branch ${req.branch} arquivada`} pelo precisa-worktree prune em ${req.date} (${req.reason})`,
  );
  return { tag };
}

/** Human-readable summary of what `archiveBranch` produced. */
export function describeArchive(a: ArchiveResult): string {
  return `archived as ${a.tag}`;
}

export function run(cmd: string, args: string[], cwd?: string): string {
  return execFileSync(cmd, args, {
    encoding: 'utf-8',
    maxBuffer: MAX_BUFFER,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...(cwd ? { cwd } : {}),
  });
}

/** `git status --porcelain` of a worktree, or null when it can't be read. */
export function readStatus(path: string): string | null {
  try {
    return run('git', ['-C', path, 'status', '--porcelain']);
  } catch {
    return null;
  }
}

/** How a `kept` line for a worktree with uncommitted changes ends, as teardown's error does. */
export const COMMIT_OR_DISCARD = 'commit or discard them, then run prune again';

/**
 * Whether `git status --porcelain` output lists a tracked change or an
 * untracked file. Ignored files (`node_modules`, `dist`) don't count. Shared by
 * `teardown` and `prune`, which both refuse to remove such a worktree.
 */
export function hasUncommittedChanges(status: string): boolean {
  return status.trim() !== '';
}
