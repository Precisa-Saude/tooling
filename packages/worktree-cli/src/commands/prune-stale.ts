import { execFileSync } from 'node:child_process';
import { closeSync, mkdirSync, openSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';

export const DAY_MS = 86_400_000;

/** Large enough for `git status` of a busy worktree; the default is 1 MiB. */
const MAX_BUFFER = 64 * 1024 * 1024;

/** `YYYY-MM-DD` in local time, used in archive tag names and directories. */
export function archiveDate(now: number): string {
  const d = new Date(now);
  const two = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

/** `~/.local/share/precisa-worktree/archive/<repo dir basename>`. */
export function defaultArchiveDir(mainRoot: string): string {
  return join(homedir(), '.local', 'share', 'precisa-worktree', 'archive', basename(mainRoot));
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
  if (!worktree) return newest;

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
  archiveDir: string;
  branch: string;
  /** `YYYY-MM-DD`, from `archiveDate`. */
  date: string;
  /** Whether the worktree has uncommitted changes to save. */
  dirty: boolean;
  /** Runs git in the main checkout. */
  git: (args: string[]) => string;
  reason: string;
  tip: string;
  worktree?: string;
}

export interface ArchiveResult {
  /** `git diff HEAD --binary` of the worktree, when not empty. */
  patch?: string;
  tag: string;
  /** Untracked files that are not ignored, as a gzipped tarball. */
  untracked?: string;
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
 * Save what removing the branch would lose: an annotated tag at the tip and,
 * for a dirty worktree, a patch of tracked changes plus a tarball of the
 * untracked files. Throws on any failure; the caller then deletes nothing.
 */
export function archiveBranch(req: ArchiveRequest): ArchiveResult {
  const tag = archiveTag(req.date, req.branch);
  tagArchive(
    req.git,
    tag,
    req.tip,
    `Branch ${req.branch} arquivada pelo precisa-worktree prune em ${req.date} (${req.reason})`,
  );
  const result: ArchiveResult = { tag };
  if (!req.worktree || !req.dirty) return result;

  const dir = join(req.archiveDir, req.date);
  mkdirSync(dir, { recursive: true });
  const base = join(dir, req.branch.replace(/\//g, '__'));

  const patch = `${base}.patch`;
  const fd = openSync(patch, 'w');
  try {
    execFileSync('git', ['-C', req.worktree, 'diff', 'HEAD', '--binary'], {
      stdio: ['ignore', fd, 'pipe'],
    });
  } finally {
    closeSync(fd);
  }
  if (statSync(patch).size > 0) result.patch = patch;
  else rmSync(patch);

  const others = run('git', [
    '-C',
    req.worktree,
    'ls-files',
    '--others',
    '--exclude-standard',
    '-z',
  ]);
  if (others) {
    const tarball = `${base}.untracked.tgz`;
    execFileSync('tar', ['-czf', tarball, '-C', req.worktree, '--null', '-T', '-'], {
      input: others,
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    result.untracked = tarball;
  }
  return result;
}

/** Human-readable list of what `archiveBranch` produced. */
export function describeArchive(a: ArchiveResult): string {
  return [
    `archived as ${a.tag}`,
    ...(a.patch ? [`patch ${a.patch}`] : []),
    ...(a.untracked ? [`untracked ${a.untracked}`] : []),
  ].join(', ');
}

export function run(cmd: string, args: string[], cwd?: string): string {
  return execFileSync(cmd, args, {
    encoding: 'utf-8',
    maxBuffer: MAX_BUFFER,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...(cwd ? { cwd } : {}),
  });
}
