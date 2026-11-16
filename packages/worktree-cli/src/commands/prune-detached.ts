import { basename } from 'node:path';

import type { PruneResult, WorktreeEntry } from './prune.js';
import { firstLine, pad } from './prune-remote.js';
import {
  archiveBranch,
  type ArchiveResult,
  archiveTag,
  DEFAULT_STALE_DAYS,
  describeArchive,
  detachedActivity,
  idleDays,
  isStale,
  readStatus,
  run,
} from './prune-stale.js';

export type DetachedDecision =
  | { action: 'ignore' | 'keep'; reason: string }
  | { action: 'remove'; dirty: boolean; reason: string };

export interface ClassifyDetachedInput {
  cwdWorktree?: string;
  /** Last activity in the worktree, epoch ms (see `detachedActivity`). */
  lastActivity: number;
  now: number;
  path: string;
  readStatus: (path: string) => string | null;
  staleDays?: number;
}

/**
 * Decide what prune does with a worktree on a detached HEAD. It has no branch
 * and so no PR to go by: it goes, archived, once idle longer than staleDays.
 */
export function classifyDetached(input: ClassifyDetachedInput): DetachedDecision {
  const { now, path } = input;
  const staleDays = input.staleDays ?? DEFAULT_STALE_DAYS;
  if (input.cwdWorktree && path === input.cwdWorktree) {
    return { action: 'keep', reason: `${path} is the current worktree: run from another one` };
  }
  const status = input.readStatus(path);
  if (status === null) return { action: 'keep', reason: `the status of ${path} can't be read` };
  const idle = idleDays(now, input.lastActivity);
  if (isStale(now, input.lastActivity, staleDays)) {
    return { action: 'remove', dirty: status.trim() !== '', reason: `idle ${idle}d` };
  }
  return {
    action: 'ignore',
    reason: `idle ${idle}d, archived and removed after ${staleDays}d idle`,
  };
}

export interface DetachedContext {
  apply: boolean;
  archiveDir: string;
  cwdWorktree: string;
  date: string;
  git: (args: string[]) => string;
  now: number;
  out: (line: string) => void;
  result: PruneResult;
  staleDays: number;
  wt: WorktreeEntry;
}

/** Archive and remove one detached worktree once stale; no branch to delete. */
export function pruneDetached(ctx: DetachedContext): void {
  const { out, result, wt } = ctx;
  let head = '';
  try {
    head = run('git', ['-C', wt.path, 'rev-parse', 'HEAD']).trim();
  } catch {
    // reported by classifyDetached as unreadable status, or archiving fails below
  }
  const decision = classifyDetached({
    cwdWorktree: ctx.cwdWorktree,
    lastActivity: detachedActivity(wt.path),
    now: ctx.now,
    path: wt.path,
    readStatus,
    staleDays: ctx.staleDays,
  });
  const what = `detached ${wt.path} (HEAD ${head.slice(0, 7)}, ${decision.reason})`;
  if (decision.action !== 'remove') {
    out(`${pad(decision.action === 'keep' ? 'kept' : 'ignored')}${what}`);
    result.kept++;
    return;
  }

  const name = `detached/${basename(wt.path)}`;
  if (!ctx.apply) {
    const extra = decision.dirty ? ' plus the uncommitted changes' : '';
    out(`${pad('would remove')}${what}; archives as ${archiveTag(ctx.date, name)}${extra}`);
    result.removed++;
    return;
  }
  let archived: ArchiveResult;
  try {
    archived = archiveBranch({
      archiveDir: ctx.archiveDir,
      branch: name,
      date: ctx.date,
      dirty: decision.dirty,
      git: ctx.git,
      reason: decision.reason,
      subject: `Worktree destacado ${wt.path} arquivado`,
      tip: head,
      worktree: wt.path,
    });
  } catch (e) {
    out(`${pad('FAILED')}${what}: archiving failed, nothing was deleted (${firstLine(e)})`);
    result.failed++;
    return;
  }
  try {
    ctx.git(['worktree', 'remove', '--force', wt.path]);
  } catch (e) {
    out(`${pad('FAILED')}${what}: not removed (${firstLine(e)}); ${describeArchive(archived)}`);
    result.failed++;
    return;
  }
  out(`${pad('removed')}${what}; ${describeArchive(archived)}`);
  result.removed++;
}
