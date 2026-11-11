import { existsSync } from 'node:fs';

import { type WorktreeConfig } from '../config.js';
import { findRepoRoot } from '../paths.js';
import { getBranchEntry, readRegistry } from '../registry.js';
import {
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
  defaultArchiveDir,
  describeArchive,
  idleDays,
  isStale,
  run,
} from './prune-stale.js';
import { releaseBranchResources, stopServices } from './teardown.js';

export type { PullRequest, RepoPullRequests } from './prune-github.js';
export {
  fetchPullRequests,
  latestPullRequests,
  lookupPullRequests,
  PR_LIST_LIMIT,
} from './prune-github.js';

/** Days without activity after which an unfinished branch is archived and removed. */
export const DEFAULT_STALE_DAYS = 7;

/** Branches without a PR under these prefixes are parked: never removed. */
export const DEFAULT_KEEP_PREFIXES = ['park/'];

export interface WorktreeEntry {
  /** Short branch name, absent for a detached HEAD. */
  branch?: string;
  path: string;
  /** The directory is gone; `git worktree prune` would drop the entry. */
  prunable?: boolean;
}

export interface PruneOptions {
  /** Actually remove; otherwise only print what would happen. */
  apply?: boolean;
  /** Where patches of uncommitted work go. Defaults to `defaultArchiveDir(mainRoot)`. */
  archiveDir?: string;
  /** Full worktree config when the repo has one; enables the teardown path. */
  cfg?: WorktreeConfig | null;
  /** Root of the worktree the command runs from. Defaults to `git rev-parse --show-toplevel`. */
  cwdWorktree?: string;
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
}

export type BranchDecision =
  | { action: 'ignore'; branch: string; reason: string }
  | { action: 'keep'; branch: string; reason: string }
  | {
      action: 'remove';
      /** Tag the tip (and save uncommitted work) before removing. */
      archive: boolean;
      branch: string;
      dirty: boolean;
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
    dirty = status.trim() !== '';
  }
  if (input.prUnknown) return keep('the PR lookup failed: run again');

  if (!pr) {
    const prefix = (input.keepPrefixes ?? DEFAULT_KEEP_PREFIXES).find((p) => branch.startsWith(p));
    if (prefix) return ignore(`no PR, parked under ${prefix}`);
  }
  const label = pr ? `PR #${pr.number} ${pr.state}` : 'no PR';
  if (pr && pr.state !== 'MERGED' && pr.state !== 'CLOSED') return keep(label);

  let problem: string;
  if (!pr) problem = label;
  else if (pr.state === 'CLOSED' && !input.includeClosed) {
    problem = `${label}: pass --include-closed to remove`;
  } else if (tip !== pr.headRefOid) problem = `${label}, but the local tip is not the PR head`;
  else if (dirty) problem = `${label}, but ${worktree} has uncommitted changes`;
  else return { action: 'remove', archive: false, branch, dirty, pr, reason: label, tip, ...at };

  const idle = idleDays(now, input.lastActivity);
  if (isStale(now, input.lastActivity, staleDays)) {
    const reason = `${problem}, idle ${idle}d`;
    return {
      action: 'remove',
      archive: true,
      branch,
      dirty,
      ...(pr ? { pr } : {}),
      reason,
      tip,
      ...at,
    };
  }
  const pending = `${problem}; idle ${idle}d, archived and removed after ${staleDays}d idle`;
  return pr ? keep(pending) : ignore(pending);
}

/** Parse `git worktree list --porcelain`. The first entry is the main checkout. */
export function parseWorktreeList(porcelain: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  let current: WorktreeEntry | null = null;
  for (const line of porcelain.split('\n')) {
    if (line.startsWith('worktree ')) {
      current = { path: line.slice('worktree '.length) };
      entries.push(current);
    } else if (current && line.startsWith('branch refs/heads/')) {
      current.branch = line.slice('branch refs/heads/'.length);
    } else if (current && (line === 'prunable' || line.startsWith('prunable '))) {
      current.prunable = true;
    }
  }
  return entries;
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
  const archiveDir = opts.archiveDir ?? defaultArchiveDir(mainRoot);
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
  const result: PruneResult = { failed: 0, freed: 0, kept: 0, removed: 0 };
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
      ...(pr ? { pr } : {}),
      ...(worktree ? { worktree } : {}),
    });

    if (decision.action !== 'remove') {
      out(`${pad(decision.action === 'keep' ? 'kept' : 'ignored')}${branch} (${decision.reason})`);
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
      const archives = decision.archive
        ? `; archives as ${archiveTag(date, branch)}${
            decision.dirty ? ' plus the uncommitted changes' : ''
          }`
        : '';
      out(`${pad('would remove')}${what}${archives}`);
      result.removed++;
      continue;
    }

    let archived: ArchiveResult | null = null;
    if (decision.archive) {
      try {
        archived = archiveBranch({
          archiveDir,
          branch,
          date,
          dirty: decision.dirty,
          git,
          reason: decision.reason,
          tip,
          ...(decision.worktree ? { worktree: decision.worktree } : {}),
        });
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
        // --force only after the archive saved the uncommitted work.
        git(['worktree', 'remove', ...(archived ? ['--force'] : []), decision.worktree]);
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

  if (cfg && existsSync(cfg.portRegistry)) {
    const live = new Set<string>();
    for (const wt of worktrees) if (wt.branch && !wt.prunable) live.add(wt.branch);
    if (mainCheckout?.branch) live.add(mainCheckout.branch);
    await collectRegistryGarbage({ apply, cfg, err, live, out, result, slotReported });
  }

  if (opts.remote) {
    pruneRemote({
      apply,
      date,
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

  out('');
  if (apply) {
    git(['worktree', 'prune']);
    out(
      `${result.removed} removed, ${result.freed} slots freed, ${result.kept} kept, ${result.failed} failed.`,
    );
  } else {
    out(
      `${result.removed} would be removed, ${result.freed} slots would be freed, ${result.kept} kept. Run with --yes to apply.`,
    );
  }
  return result;
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

function readStatus(path: string): string | null {
  try {
    return run('git', ['-C', path, 'status', '--porcelain']);
  } catch {
    return null;
  }
}
