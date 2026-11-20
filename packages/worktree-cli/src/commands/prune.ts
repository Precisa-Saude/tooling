import { existsSync } from 'node:fs';

import { type WorktreeConfig } from '../config.js';
import { findRepoRoot, parseWorktreeList } from '../paths.js';
import { getBranchEntry, readRegistry } from '../registry.js';
import { pruneDetached } from './prune-detached.js';
import {
  deleteRemoteBranchViaApi,
  fetchPullRequests,
  latestPullRequests,
  lookupPullRequests,
  type PullRequest,
  type RepoPullRequests,
} from './prune-github.js';
import { firstLine, pad, pruneRemote } from './prune-remote.js';
import {
  archiveBranch,
  archiveDate,
  type ArchiveResult,
  archiveTag,
  branchActivity,
  COMMIT_OR_DISCARD,
  DEFAULT_STALE_DAYS,
  describeArchive,
  hasUncommittedChanges,
  idleDays,
  isStale,
  readStatus,
  run,
} from './prune-stale.js';
import { releaseBranchResources, stopServices } from './teardown.js';

export type { WorktreeEntry } from '../paths.js';
export { parseWorktreeList } from '../paths.js';
export type { ClassifyDetachedInput, DetachedDecision } from './prune-detached.js';
export { classifyDetached } from './prune-detached.js';
export type { PullRequest, RepoPullRequests } from './prune-github.js';
export {
  deleteRemoteBranchViaApi,
  fetchPullRequests,
  latestPullRequests,
  lookupPullRequests,
  PR_LIST_LIMIT,
} from './prune-github.js';
export { DEFAULT_STALE_DAYS } from './prune-stale.js';

/**
 * Idle days before a merged PR's branch with commits past the PR head is
 * archived and removed. Short because the PR is done; the day covers an agent
 * that just committed the next fix on top of it.
 */
export const MERGED_GRACE_DAYS = 1;

/** Branches without a PR under these prefixes are parked: never removed. */
export const DEFAULT_KEEP_PREFIXES = ['park/'];

export interface PruneOptions {
  /** Actually remove; otherwise only print what would happen. */
  apply?: boolean;
  /** Full worktree config when the repo has one; enables the teardown path. */
  cfg?: WorktreeConfig | null;
  /** Root of the worktree the command runs from. Defaults to `git rev-parse --show-toplevel`. */
  cwdWorktree?: string;
  /**
   * Deletes one remote branch. Defaults to the GitHub API
   * (deleteRemoteBranchViaApi); tests swap in a local `origin`.
   */
  deleteRemoteBranch?: (branch: string) => void;
  err?: (line: string) => void;
  /** Also remove branches whose PR was closed without merge. */
  includeClosed?: boolean;
  /** Prefixes that park a branch without a PR. Defaults to `DEFAULT_KEEP_PREFIXES`. */
  keepPrefixes?: string[];
  /** PRs of one head branch (tests). When absent, `gh pr list --head` is called. */
  lookupPullRequests?: (branch: string) => PullRequest[];
  /** Main checkout (first entry of `git worktree list`). */
  mainRoot: string;
  /** Current time in epoch ms (tests). */
  now?: number;
  out?: (line: string) => void;
  protectedBranches?: string[];
  /** Pre-fetched PRs (tests). When absent, `gh` is called once. */
  pullRequests?: RepoPullRequests;
  /** Also delete remote branches of merged PRs that GitHub left behind. */
  remote?: boolean;
  /** Idle days before an unfinished branch is archived and removed. */
  staleDays?: number;
}

export interface PruneResult {
  failed: number;
  /** Registry slots freed because their worktree was gone. */
  freed: number;
  kept: number;
  removed: number;
  /** Worktrees kept because of uncommitted changes; also counted in `kept`. */
  uncommitted: number;
}

export type BranchDecision =
  | { action: 'ignore'; branch: string; reason: string }
  | {
      action: 'keep';
      branch: string;
      reason: string;
      /** Kept only because its worktree has uncommitted changes. */
      uncommitted?: true;
    }
  | {
      action: 'remove';
      /** Tag the tip before removing. */
      archive: boolean;
      branch: string;
      pr?: PullRequest;
      reason: string;
      tip: string;
      worktree?: string;
    };

export interface ClassifyInput {
  branch: string;
  /** Root of the worktree the command runs from. */
  cwdWorktree?: string;
  includeClosed: boolean;
  keepPrefixes?: string[];
  /** Last activity on the branch, epoch ms (see `branchActivity`). */
  lastActivity: number;
  /** Branch names never removed: `main`, the default branch, the main checkout's branch, protected. */
  neverTouch: Map<string, string>;
  /** Current time, epoch ms. */
  now: number;
  pr?: PullRequest;
  /** The one-by-one PR lookup failed, so whether the branch has a PR is unknown. */
  prUnknown?: boolean;
  /** `git status --porcelain` of the worktree, or null when it can't be read. */
  readStatus: (path: string) => string | null;
  staleDays?: number;
  tip: string;
  /** The tip is an ancestor of the PR head, so the branch holds nothing the PR lacks. */
  tipInPrHead?: boolean;
  worktree?: string;
}

/** Decide what prune does with one local branch. Pure apart from `readStatus`. */
export function classifyBranch(input: ClassifyInput): BranchDecision {
  const { branch, now, pr, tip, worktree } = input;
  const staleDays = input.staleDays ?? DEFAULT_STALE_DAYS;
  const keep = (reason: string): BranchDecision => ({ action: 'keep', branch, reason });
  const ignore = (reason: string): BranchDecision => ({ action: 'ignore', branch, reason });
  const at = worktree ? { worktree } : {};

  const reserved = input.neverTouch.get(branch);
  if (reserved) return keep(reserved);
  if (worktree && input.cwdWorktree && worktree === input.cwdWorktree) {
    return keep(`${worktree} is the current worktree: run from another one`);
  }
  let dirty = false;
  if (worktree) {
    const status = input.readStatus(worktree);
    if (status === null) return keep(`the status of ${worktree} can't be read`);
    dirty = hasUncommittedChanges(status);
  }
  if (input.prUnknown) return keep('the PR lookup failed: run again');

  if (!pr) {
    const prefix = (input.keepPrefixes ?? DEFAULT_KEEP_PREFIXES).find((p) => branch.startsWith(p));
    if (prefix) return ignore(`no PR, parked under ${prefix}`);
  }
  const label = pr ? `PR #${pr.number} ${pr.state}` : 'no PR';
  if (pr && pr.state !== 'MERGED' && pr.state !== 'CLOSED') return keep(label);
  // Never removed nor archived, whatever the PR and however idle, like teardown.
  if (dirty) {
    const reason = `${label}, but ${worktree} has uncommitted changes: ${COMMIT_OR_DISCARD}`;
    return { action: 'keep', branch, reason, uncommitted: true };
  }

  const behind = tip !== pr?.headRefOid && input.tipInPrHead === true;
  let problem: string;
  if (!pr) problem = label;
  else if (pr.state === 'CLOSED' && !input.includeClosed) {
    problem = `${label}: pass --include-closed to remove`;
  } else if (tip !== pr.headRefOid && !behind) {
    problem = `${label}, but the local tip has commits not in the PR head`;
  } else {
    const reason = behind ? `${label}, local tip behind the PR head` : label;
    return { action: 'remove', archive: false, branch, pr, reason, tip, ...at };
  }

  const waitDays = pr?.state === 'MERGED' ? Math.min(staleDays, MERGED_GRACE_DAYS) : staleDays;
  const idle = idleDays(now, input.lastActivity);
  if (isStale(now, input.lastActivity, waitDays)) {
    const reason = `${problem}, idle ${idle}d`;
    return {
      action: 'remove',
      archive: true,
      branch,
      ...(pr ? { pr } : {}),
      reason,
      tip,
      ...at,
    };
  }
  const pending = `${problem}; idle ${idle}d, archived and removed after ${waitDays}d idle`;
  return pr ? keep(pending) : ignore(pending);
}

export async function prune(opts: PruneOptions): Promise<PruneResult> {
  const out = opts.out ?? ((line: string) => process.stdout.write(`${line}\n`));
  const err = opts.err ?? ((line: string) => process.stderr.write(`${line}\n`));
  const apply = opts.apply ?? false;
  const includeClosed = opts.includeClosed ?? false;
  const cfg = opts.cfg ?? null;
  const { mainRoot } = opts;
  const now = opts.now ?? Date.now();
  const staleDays = opts.staleDays ?? DEFAULT_STALE_DAYS;
  const keepPrefixes = opts.keepPrefixes ?? DEFAULT_KEEP_PREFIXES;
  const date = archiveDate(now);
  const git = (args: string[]): string => run('git', ['-C', mainRoot, ...args]);

  // Worktrees whose directory is gone would block `git branch -D`.
  if (apply) git(['worktree', 'prune']);
  const worktrees = parseWorktreeList(git(['worktree', 'list', '--porcelain']));
  const mainCheckout = worktrees[0];
  const worktreeOf = new Map<string, string>();
  for (const wt of worktrees.slice(1)) {
    if (wt.branch && !wt.prunable && !worktreeOf.has(wt.branch)) worktreeOf.set(wt.branch, wt.path);
  }

  const repoPrs = opts.pullRequests ?? fetchPullRequests(mainRoot, err);
  const prByHead = latestPullRequests(repoPrs.pullRequests);

  // Later entries win, so the most specific reason is the one printed.
  const neverTouch = new Map<string, string>();
  neverTouch.set('main', 'never pruned');
  if (repoPrs.defaultBranch) neverTouch.set(repoPrs.defaultBranch, 'default branch');
  if (mainCheckout?.branch) neverTouch.set(mainCheckout.branch, 'checked out in the main checkout');
  for (const b of opts.protectedBranches ?? []) neverTouch.set(b, 'protected in worktree.prune');

  const { nameWithOwner } = repoPrs;
  const lookup =
    opts.lookupPullRequests ??
    (nameWithOwner ? (b: string) => lookupPullRequests(mainRoot, nameWithOwner, b) : undefined);
  const looked = new Set<string>();
  const prUnknown = new Set<string>();
  const prFor = (branch: string): PullRequest | undefined => {
    const known = prByHead.get(branch);
    if (known || !repoPrs.truncated || !lookup || neverTouch.has(branch) || looked.has(branch)) {
      return known;
    }
    looked.add(branch);
    try {
      const found = latestPullRequests(lookup(branch)).get(branch);
      if (found) prByHead.set(branch, found);
      return found;
    } catch (e) {
      prUnknown.add(branch);
      err(`warning: looking up the PR of ${branch} failed (${firstLine(e)})`);
      return undefined;
    }
  };

  const cwdWorktree = opts.cwdWorktree ?? findRepoRoot();
  const result: PruneResult = { failed: 0, freed: 0, kept: 0, removed: 0, uncommitted: 0 };
  /** `kept` lines of worktrees with uncommitted changes, printed apart. */
  const uncommittedLines: string[] = [];
  /** Branches whose "would remove" line already reports the slot it frees. */
  const slotReported = new Set<string>();

  const refs = git([
    'for-each-ref',
    '--format=%(refname)%09%(objectname)%09%(committerdate:unix)',
    'refs/heads/',
  ]);
  for (const line of refs.split('\n')) {
    if (!line) continue;
    const [ref = '', tip = '', tipTime = '0'] = line.split('\t');
    const branch = ref.replace(/^refs\/heads\//, '');
    const worktree = worktreeOf.get(branch);
    const pr = prFor(branch);
    const decision = classifyBranch({
      branch,
      cwdWorktree,
      includeClosed,
      keepPrefixes,
      lastActivity: branchActivity(mainRoot, branch, Number(tipTime) * 1000, worktree),
      neverTouch,
      now,
      prUnknown: prUnknown.has(branch),
      readStatus,
      staleDays,
      tip,
      ...(pr?.state === 'MERGED' && tip !== pr.headRefOid
        ? { tipInPrHead: isAncestor(git, tip, pr.headRefOid) }
        : {}),
      ...(pr ? { pr } : {}),
      ...(worktree ? { worktree } : {}),
    });

    if (decision.action !== 'remove') {
      const line = `${pad(decision.action === 'keep' ? 'kept' : 'ignored')}${branch} (${decision.reason})`;
      if (decision.action === 'keep' && decision.uncommitted) {
        uncommittedLines.push(line);
        result.uncommitted++;
      } else out(line);
      result.kept++;
      continue;
    }

    // Reading a missing registry would create it; a dry run must not write.
    const entry = cfg && existsSync(cfg.portRegistry) ? await getBranchEntry(cfg, branch) : null;
    const what = `${branch} (${decision.reason}, tip ${tip.slice(0, 7)})${
      decision.worktree ? ` and ${decision.worktree}` : ''
    }${entry ? `, frees slot ${entry.slot}` : ''}`;
    if (!apply) {
      if (entry) slotReported.add(branch);
      const archives = decision.archive ? `; archives as ${archiveTag(date, branch)}` : '';
      out(`${pad('would remove')}${what}${archives}`);
      result.removed++;
      continue;
    }

    let archived: ArchiveResult | null = null;
    if (decision.archive) {
      try {
        archived = archiveBranch({ branch, date, git, reason: decision.reason, tip });
      } catch (e) {
        out(`${pad('FAILED')}${branch}: archiving failed, nothing was deleted (${firstLine(e)})`);
        result.failed++;
        continue;
      }
    }
    const saved = archived ? `; ${describeArchive(archived)}` : '';

    if (cfg && entry) await stopServices(cfg, entry);
    if (decision.worktree) {
      try {
        // No --force: git refuses a worktree that got changes after it was classified.
        git(['worktree', 'remove', decision.worktree]);
      } catch (e) {
        out(
          `${pad('FAILED')}${branch}: worktree ${decision.worktree} was not removed, nothing was deleted (${firstLine(e)})${saved}`,
        );
        result.failed++;
        continue;
      }
    }
    try {
      git(['branch', '-D', branch]);
    } catch (e) {
      const prefix = decision.worktree ? 'the worktree was removed, but ' : '';
      out(
        `${pad('FAILED')}${branch}: ${prefix}the branch was not deleted (${firstLine(e)})${saved}`,
      );
      result.failed++;
      continue;
    }
    if (cfg && entry) await releaseBranchResources(cfg, branch);
    out(`${pad('removed')}${what}${saved}`);
    result.removed++;
  }

  for (const wt of worktrees.slice(1)) {
    if (wt.branch || wt.prunable) continue;
    pruneDetached({
      apply,
      cwdWorktree,
      date,
      git,
      now,
      out,
      result,
      staleDays,
      uncommittedLines,
      wt,
    });
  }

  if (cfg && existsSync(cfg.portRegistry)) {
    const live = new Set<string>();
    for (const wt of worktrees) if (wt.branch && !wt.prunable) live.add(wt.branch);
    if (mainCheckout?.branch) live.add(mainCheckout.branch);
    await collectRegistryGarbage({ apply, cfg, err, live, out, result, slotReported });
  }

  if (opts.remote) {
    const deleteBranch =
      opts.deleteRemoteBranch ??
      (nameWithOwner ? (b: string) => deleteRemoteBranchViaApi(nameWithOwner, b) : undefined);
    pruneRemote({
      apply,
      date,
      ...(deleteBranch ? { deleteBranch } : {}),
      git,
      includeClosed,
      neverTouch,
      now,
      out,
      prFor,
      result,
      staleDays,
    });
  }

  if (uncommittedLines.length > 0) {
    out('');
    out('Worktrees with uncommitted changes, never removed by prune:');
    for (const line of uncommittedLines) out(line);
  }

  out('');
  const kept = `${result.kept} kept${
    result.uncommitted > 0 ? ` (${result.uncommitted} with uncommitted changes)` : ''
  }`;
  if (apply) {
    git(['worktree', 'prune']);
    out(
      `${result.removed} removed, ${result.freed} slots freed, ${kept}, ${result.failed} failed.`,
    );
  } else {
    out(
      `${result.removed} would be removed, ${result.freed} slots would be freed, ${kept}. Run with --yes to apply.`,
    );
  }
  return result;
}

/** `ancestor` is reachable from `descendant`; false when either is missing locally. */
function isAncestor(
  git: (args: string[]) => string,
  ancestor: string,
  descendant: string,
): boolean {
  try {
    git(['merge-base', '--is-ancestor', ancestor, descendant]);
    return true;
  } catch {
    return false;
  }
}

interface RegistryGcContext {
  apply: boolean;
  cfg: WorktreeConfig;
  err: (line: string) => void;
  /** Branches checked out in a worktree that still exists. */
  live: Set<string>;
  out: (line: string) => void;
  result: PruneResult;
  /** Dry run: branches whose "would remove" line already says it frees the slot. */
  slotReported: Set<string>;
}

/**
 * Registry entries whose worktree is gone keep their slot, and often a dev
 * server, forever. Stop the servers and free the slot.
 */
async function collectRegistryGarbage(ctx: RegistryGcContext): Promise<void> {
  const { cfg, out, result } = ctx;
  const registry = await readRegistry(cfg);
  for (const [branch, entry] of Object.entries(registry)) {
    if (ctx.live.has(branch) || ctx.slotReported.has(branch)) continue;
    if (!ctx.apply) {
      out(`${pad('would free')}slot ${entry.slot} of ${branch} (worktree gone)`);
      result.freed++;
      continue;
    }
    try {
      await stopServices(cfg, entry);
    } catch (e) {
      ctx.err(`warning: could not stop the servers of ${branch} (${firstLine(e)})`);
    }
    await releaseBranchResources(cfg, branch);
    out(`${pad('freed')}slot ${entry.slot} of ${branch} (worktree gone)`);
    result.freed++;
  }
}
