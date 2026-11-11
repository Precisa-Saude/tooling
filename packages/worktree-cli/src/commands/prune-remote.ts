import { archiveTag, idleDays, isStale, tagArchive } from './prune-stale.js';

export interface RemotePullRequest {
  headRefOid: string;
  number: number;
  state: string;
}

export interface RemoteContext {
  apply: boolean;
  /** `YYYY-MM-DD` for archive tags. */
  date: string;
  /** Deletes one remote branch; undefined when the GitHub repo is unknown, so nothing remote is deleted. */
  deleteBranch?: (branch: string) => void;
  git: (args: string[]) => string;
  includeClosed: boolean;
  neverTouch: Map<string, string>;
  now: number;
  out: (line: string) => void;
  /** PR of a head branch, looking it up one by one when the bulk list was truncated. */
  prFor: (branch: string) => RemotePullRequest | undefined;
  result: { failed: number; kept: number; removed: number };
  staleDays: number;
}

/**
 * Remote branches of merged (or closed, with --include-closed) PRs. A remote
 * tip that is the PR head is deleted right away; any other tip is deleted
 * once its commit is older than `staleDays`, after an archive tag at it.
 */
export function pruneRemote(ctx: RemoteContext): void {
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
    const pr = ctx.prFor(branch);
    if (!pr) continue;
    const eligible = pr.state === 'MERGED' || (pr.state === 'CLOSED' && ctx.includeClosed);
    if (!eligible) continue;
    const reserved = ctx.neverTouch.get(branch);
    if (reserved) {
      out(`${pad('kept')}${label} (${reserved})`);
      result.kept++;
      continue;
    }
    const prLabel = `PR #${pr.number} ${pr.state}`;

    let tag: string | undefined;
    let what = `${label} (${prLabel}, tip ${tip.slice(0, 7)})`;
    if (tip !== pr.headRefOid) {
      const time = remoteTipTime(git, branch, tip);
      if (time === null) {
        out(
          `${pad('kept')}${label} (${prLabel}, but the remote tip ${tip.slice(0, 7)} can't be read)`,
        );
        result.kept++;
        continue;
      }
      const idle = idleDays(ctx.now, time);
      const problem = `${prLabel}, but the remote tip is not the PR head`;
      if (!isStale(ctx.now, time, ctx.staleDays)) {
        out(
          `${pad('kept')}${label} (${problem}; idle ${idle}d, archived and removed after ${ctx.staleDays}d idle)`,
        );
        result.kept++;
        continue;
      }
      tag = archiveTag(ctx.date, `origin__${branch}`);
      what = `${label} (${problem}, idle ${idle}d, tip ${tip.slice(0, 7)})`;
    }

    if (!ctx.apply) {
      out(`${pad('would remove')}${what}${tag ? `; archives as ${tag}` : ''}`);
      result.removed++;
      continue;
    }
    if (!ctx.deleteBranch) {
      out(`${pad('FAILED')}${label}: the GitHub repo is unknown, so the branch was not deleted`);
      result.failed++;
      continue;
    }
    if (tag) {
      try {
        tagArchive(
          git,
          tag,
          tip,
          `Branch remota origin/${branch} arquivada pelo precisa-worktree prune em ${ctx.date} (${prLabel})`,
        );
      } catch (e) {
        out(`${pad('FAILED')}${label}: archiving failed, nothing was deleted (${firstLine(e)})`);
        result.failed++;
        continue;
      }
    }
    try {
      ctx.deleteBranch(branch);
    } catch (e) {
      out(`${pad('FAILED')}${label}: deleting through the GitHub API failed (${firstLine(e)})`);
      result.failed++;
      continue;
    }
    out(`${pad('removed')}${what}${tag ? `; archived as ${tag}` : ''}`);
    result.removed++;
  }
}

/** Committer date of a remote tip in epoch ms, fetching the branch when the commit is missing. */
function remoteTipTime(
  git: (args: string[]) => string,
  branch: string,
  tip: string,
): number | null {
  try {
    git(['cat-file', '-e', `${tip}^{commit}`]);
  } catch {
    try {
      git(['fetch', '-q', '--no-tags', 'origin', `refs/heads/${branch}`]);
    } catch {
      return null;
    }
  }
  try {
    return Number(git(['log', '-1', '--format=%ct', tip]).trim()) * 1000;
  } catch {
    return null;
  }
}

export function pad(label: string): string {
  return label.padEnd(13);
}

export function firstLine(e: unknown): string {
  const stderr = (e as { stderr?: Buffer | string }).stderr?.toString().trim();
  const msg = stderr || (e as Error).message || String(e);
  return msg.split('\n')[0] ?? msg;
}
