import { run } from './prune-stale.js';

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
  /** `owner/repo`, needed to look PRs up one branch at a time. */
  nameWithOwner?: string;
  pullRequests: PullRequest[];
  /** The bulk list hit `PR_LIST_LIMIT`: branches missing from it are looked up one by one. */
  truncated?: boolean;
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

const PR_FIELDS = 'headRefName,state,number,headRefOid,isCrossRepository';

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
        PR_FIELDS,
      ],
      mainRoot,
    ),
  ) as PullRequest[];
  const truncated = pullRequests.length >= PR_LIST_LIMIT;
  if (truncated) {
    err(
      `warning: gh returned ${PR_LIST_LIMIT} PRs, the limit; branches missing from that list are looked up one by one`,
    );
  }
  const defaultBranch = repo.defaultBranchRef?.name;
  return {
    ...(defaultBranch ? { defaultBranch } : {}),
    nameWithOwner: repo.nameWithOwner,
    pullRequests,
    truncated,
  };
}

/** PRs whose head is `branch`, for branches older than the bulk list reaches. */
export function lookupPullRequests(
  mainRoot: string,
  nameWithOwner: string,
  branch: string,
): PullRequest[] {
  return JSON.parse(
    run(
      'gh',
      [
        'pr',
        'list',
        '--repo',
        nameWithOwner,
        '--head',
        branch,
        '--state',
        'all',
        '--limit',
        '5',
        '--json',
        PR_FIELDS,
      ],
      mainRoot,
    ),
  ) as PullRequest[];
}
