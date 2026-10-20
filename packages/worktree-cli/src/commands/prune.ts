import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { type WorktreeConfig } from '../config.js';
import { findRepoRoot } from '../paths.js';
import { getBranchEntry } from '../registry.js';
import { releaseBranchResources, stopServices } from './teardown.js';

/** `gh pr list --limit`. Hitting it means older PRs are missing from the answer. */
export const PR_LIST_LIMIT = 500;

export interface PullRequest {
  headRefName: string;
  headRefOid: string;
  isCrossRepository: boolean;
  number: number;
  state: string;
}

export interface RepoPullRequests {
  /** The repo's default branch on GitHub, never touched (besides `main`). */
  defaultBranch?: string;
  pullRequests: PullRequest[];
}

export interface WorktreeEntry {
  /** Short branch name, absent for a detached HEAD. */
  branch?: string;
  path: string;
}

export interface PruneOptions {
  /** Actually remove; otherwise only print what would happen. */
  apply?: boolean;
  /** Full worktree config when the repo has one; enables the teardown path. */
  cfg?: WorktreeConfig | null;
  /** Root of the worktree the command runs from. Defaults to `git rev-parse --show-toplevel`. */
  cwdWorktree?: string;
  err?: (line: string) => void;
  /** Also remove branches whose PR was closed without merge. */
  includeClosed?: boolean;
  /** Main checkout (first entry of `git worktree list`). */
  mainRoot: string;
  out?: (line: string) => void;
  protectedBranches?: string[];
  /** Pre-fetched PRs (tests). When absent, `gh` is called once. */
  pullRequests?: RepoPullRequests;
  /** Also delete remote branches of merged PRs that GitHub left behind. */
  remote?: boolean;
}

export interface PruneResult {
  failed: number;
  kept: number;
  removed: number;
}

export type BranchDecision =
  | { action: 'ignore'; branch: string; reason: string }
  | { action: 'keep'; branch: string; reason: string }
  | { action: 'remove'; branch: string; pr: PullRequest; tip: string; worktree?: string };

export interface ClassifyInput {
  branch: string;
  /** Root of the worktree the command runs from. */
  cwdWorktree?: string;
  includeClosed: boolean;
  /** Branch names never removed: `main`, the default branch, the main checkout's branch, protected. */
  neverTouch: Map<string, string>;
  pr?: PullRequest;
  /** `git status --porcelain` of the worktree, or null when it can't be read. */
  readStatus: (path: string) => string | null;
  tip: string;
  worktree?: string;
}

/** Decide what prune does with one local branch. Pure apart from `readStatus`. */
export function classifyBranch(input: ClassifyInput): BranchDecision {
  const { branch, pr, tip, worktree } = input;
  const reserved = input.neverTouch.get(branch);
  if (reserved) return { action: 'keep', branch, reason: reserved };

  if (!pr) return { action: 'ignore', branch, reason: 'no PR: review by hand' };
  const label = `PR #${pr.number} ${pr.state}`;
  if (pr.state === 'OPEN') return { action: 'keep', branch, reason: label };
  if (pr.state === 'CLOSED' && !input.includeClosed) {
    return { action: 'keep', branch, reason: `${label}: pass --include-closed to remove` };
  }
  if (pr.state !== 'MERGED' && pr.state !== 'CLOSED') {
    return { action: 'keep', branch, reason: label };
  }
  if (tip !== pr.headRefOid) {
    return { action: 'keep', branch, reason: `${label}, but the local tip is not the PR head` };
  }

  if (worktree) {
    if (input.cwdWorktree && worktree === input.cwdWorktree) {
      return {
        action: 'keep',
        branch,
        reason: `${label}, but ${worktree} is the current worktree: run from another one`,
      };
    }
    const status = input.readStatus(worktree);
    if (status === null) {
      return {
        action: 'keep',
        branch,
        reason: `${label}, but the status of ${worktree} can't be read`,
      };
    }
    if (status.trim() !== '') {
      return {
        action: 'keep',
        branch,
        reason: `${label}, but ${worktree} has uncommitted changes`,
      };
    }
  }

  return worktree
    ? { action: 'remove', branch, pr, tip, worktree }
    : { action: 'remove', branch, pr, tip };
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
    }
  }
  return entries;
}

/** Most recent same-repo PR per head branch name. Fork PRs are dropped. */
export function latestPullRequests(prs: PullRequest[]): Map<string, PullRequest> {
  const byHead = new Map<string, PullRequest>();
  for (const pr of prs) {
    if (pr.isCrossRepository) continue;
    const seen = byHead.get(pr.headRefName);
    if (!seen || pr.number > seen.number) byHead.set(pr.headRefName, pr);
  }
  return byHead;
}

/** One `gh repo view` plus one `gh pr list` for the whole repo. */
export function fetchPullRequests(mainRoot: string, err: (line: string) => void): RepoPullRequests {
  const repo = JSON.parse(
    run('gh', ['repo', 'view', '--json', 'nameWithOwner,defaultBranchRef'], mainRoot),
  ) as { defaultBranchRef?: { name?: string }; nameWithOwner: string };
  const pullRequests = JSON.parse(
    run(
      'gh',
      [
        'pr',
        'list',
        '--repo',
        repo.nameWithOwner,
        '--state',
        'all',
        '--limit',
        String(PR_LIST_LIMIT),
        '--json',
        'headRefName,state,number,headRefOid,isCrossRepository',
      ],
      mainRoot,
    ),
  ) as PullRequest[];
  if (pullRequests.length >= PR_LIST_LIMIT) {
    err(
      `warning: gh returned ${PR_LIST_LIMIT} PRs, the limit; branches of older PRs show up as having no PR`,
    );
  }
  const defaultBranch = repo.defaultBranchRef?.name;
  return defaultBranch ? { defaultBranch, pullRequests } : { pullRequests };
}

export async function prune(opts: PruneOptions): Promise<PruneResult> {
  const out = opts.out ?? ((line: string) => process.stdout.write(`${line}\n`));
  const err = opts.err ?? ((line: string) => process.stderr.write(`${line}\n`));
  const apply = opts.apply ?? false;
  const includeClosed = opts.includeClosed ?? false;
  const cfg = opts.cfg ?? null;
  const { mainRoot } = opts;
  const git = (args: string[]): string => run('git', ['-C', mainRoot, ...args]);

  const worktrees = parseWorktreeList(git(['worktree', 'list', '--porcelain']));
  const mainCheckout = worktrees[0];
  const worktreeOf = new Map<string, string>();
  for (const wt of worktrees.slice(1)) {
    if (wt.branch && !worktreeOf.has(wt.branch)) worktreeOf.set(wt.branch, wt.path);
  }

  const repoPrs = opts.pullRequests ?? fetchPullRequests(mainRoot, err);
  const prByHead = latestPullRequests(repoPrs.pullRequests);

  // Later entries win, so the most specific reason is the one printed.
  const neverTouch = new Map<string, string>();
  neverTouch.set('main', 'never pruned');
  if (repoPrs.defaultBranch) neverTouch.set(repoPrs.defaultBranch, 'default branch');
  if (mainCheckout?.branch) neverTouch.set(mainCheckout.branch, 'checked out in the main checkout');
  for (const b of opts.protectedBranches ?? []) neverTouch.set(b, 'protected in worktree.prune');

  const cwdWorktree = opts.cwdWorktree ?? findRepoRoot();
  const result: PruneResult = { failed: 0, kept: 0, removed: 0 };

  const refs = git(['for-each-ref', '--format=%(refname)%09%(objectname)', 'refs/heads/']);
  for (const line of refs.split('\n')) {
    if (!line) continue;
    const [ref = '', tip = ''] = line.split('\t');
    const branch = ref.replace(/^refs\/heads\//, '');
    const worktree = worktreeOf.get(branch);
    const pr = prByHead.get(branch);
    const decision = classifyBranch({
      branch,
      cwdWorktree,
      includeClosed,
      neverTouch,
      readStatus,
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
    const what = `${branch} (PR #${decision.pr.number} ${decision.pr.state}, tip ${tip.slice(0, 7)})${
      decision.worktree ? ` and ${decision.worktree}` : ''
    }${entry ? `, frees slot ${entry.slot}` : ''}`;
    if (!apply) {
      out(`${pad('would remove')}${what}`);
      result.removed++;
      continue;
    }

    if (cfg && entry) await stopServices(cfg, entry);
    if (decision.worktree) {
      try {
        git(['worktree', 'remove', decision.worktree]);
      } catch (e) {
        out(
          `${pad('FAILED')}${branch}: worktree ${decision.worktree} was not removed, nothing was deleted (${firstLine(e)})`,
        );
        result.failed++;
        continue;
      }
    }
    try {
      git(['branch', '-D', branch]);
    } catch (e) {
      const prefix = decision.worktree ? 'the worktree was removed, but ' : '';
      out(`${pad('FAILED')}${branch}: ${prefix}the branch was not deleted (${firstLine(e)})`);
      result.failed++;
      continue;
    }
    if (cfg && entry) await releaseBranchResources(cfg, branch);
    out(`${pad('removed')}${what}`);
    result.removed++;
  }

  if (opts.remote) pruneRemote({ apply, git, includeClosed, neverTouch, out, prByHead, result });

  out('');
  if (apply) {
    git(['worktree', 'prune']);
    out(`${result.removed} removed, ${result.kept} kept, ${result.failed} failed.`);
  } else {
    out(`${result.removed} would be removed, ${result.kept} kept. Run with --yes to apply.`);
  }
  return result;
}

interface RemoteContext {
  apply: boolean;
  git: (args: string[]) => string;
  includeClosed: boolean;
  neverTouch: Map<string, string>;
  out: (line: string) => void;
  prByHead: Map<string, PullRequest>;
  result: PruneResult;
}

/** Remote branches of merged (or closed) PRs whose tip is still the PR head. */
function pruneRemote(ctx: RemoteContext): void {
  const { git, out, result } = ctx;
  let heads: string;
  try {
    heads = git(['ls-remote', '--heads', 'origin']);
  } catch (e) {
    out(`${pad('FAILED')}--remote: could not list the branches on origin (${firstLine(e)})`);
    result.failed++;
    return;
  }

  for (const line of heads.split('\n')) {
    if (!line) continue;
    const [tip = '', ref = ''] = line.split('\t');
    const branch = ref.replace(/^refs\/heads\//, '');
    const label = `origin/${branch}`;
    const pr = ctx.prByHead.get(branch);
    if (!pr) continue;
    const eligible = pr.state === 'MERGED' || (pr.state === 'CLOSED' && ctx.includeClosed);
    if (!eligible) continue;
    const reserved = ctx.neverTouch.get(branch);
    if (reserved) {
      out(`${pad('kept')}${label} (${reserved})`);
      result.kept++;
      continue;
    }
    if (tip !== pr.headRefOid) {
      out(
        `${pad('kept')}${label} (PR #${pr.number} ${pr.state}, but the remote tip is not the PR head)`,
      );
      result.kept++;
      continue;
    }
    const what = `${label} (PR #${pr.number} ${pr.state}, tip ${tip.slice(0, 7)})`;
    if (!ctx.apply) {
      out(`${pad('would remove')}${what}`);
      result.removed++;
      continue;
    }
    try {
      git(['push', 'origin', '--delete', branch]);
    } catch (e) {
      out(`${pad('FAILED')}${label}: git push origin --delete failed (${firstLine(e)})`);
      result.failed++;
      continue;
    }
    out(`${pad('removed')}${what}`);
    result.removed++;
  }
}

function readStatus(path: string): string | null {
  try {
    return run('git', ['-C', path, 'status', '--porcelain']);
  } catch {
    return null;
  }
}

function run(cmd: string, args: string[], cwd?: string): string {
  return execFileSync(cmd, args, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...(cwd ? { cwd } : {}),
  });
}

function pad(label: string): string {
  return label.padEnd(13);
}

function firstLine(e: unknown): string {
  const stderr = (e as { stderr?: Buffer | string }).stderr?.toString().trim();
  const msg = stderr || (e as Error).message || String(e);
  return msg.split('\n')[0] ?? msg;
}
