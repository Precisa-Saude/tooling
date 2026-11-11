/**
 * Unit tests for the pure parts of `prune`: worktree-list parsing, PR
 * de-duplication, the per-branch decision and the lenient config loader.
 */
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  archiveDate,
  classifyBranch,
  DEFAULT_STALE_DAYS,
  idleDays,
  deleteRemoteBranchViaApi,
  latestPullRequests,
  loadPruneConfig,
  parseStatusPaths,
  parseWorktreeList,
} from '../dist/index.js';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 11, 12);

const pr = (over = {}) => ({
  headRefName: 'feat/x',
  headRefOid: 'a'.repeat(40),
  isCrossRepository: false,
  number: 1,
  state: 'MERGED',
  ...over,
});

const base = (over = {}) => ({
  branch: 'feat/x',
  includeClosed: false,
  lastActivity: NOW - DAY,
  neverTouch: new Map([['main', 'never pruned']]),
  now: NOW,
  pr: pr(),
  readStatus: () => '',
  tip: 'a'.repeat(40),
  ...over,
});

/** Same input, idle for `days` days. */
const idle = (days, over = {}) => base({ lastActivity: NOW - days * DAY, ...over });

describe('parseWorktreeList', () => {
  it('reads paths and branches, main checkout first, detached HEAD without branch', () => {
    const out = [
      'worktree /repo',
      'HEAD 1111',
      'branch refs/heads/main',
      '',
      'worktree /repo-feat-a',
      'HEAD 2222',
      'branch refs/heads/feat/a',
      '',
      'worktree /repo-detached',
      'HEAD 3333',
      'detached',
      '',
      'worktree /repo-gone',
      'HEAD 4444',
      'branch refs/heads/feat/gone',
      'prunable gitdir file points to non-existent location',
      '',
    ].join('\n');
    assert.deepEqual(parseWorktreeList(out), [
      { branch: 'main', path: '/repo' },
      { branch: 'feat/a', path: '/repo-feat-a' },
      { path: '/repo-detached' },
      { branch: 'feat/gone', path: '/repo-gone', prunable: true },
    ]);
  });
});

describe('latestPullRequests', () => {
  it('keeps the most recent PR per head name and drops fork PRs', () => {
    const map = latestPullRequests([
      pr({ number: 3, state: 'OPEN' }),
      pr({ number: 9, state: 'MERGED', isCrossRepository: true }),
      pr({ number: 1, state: 'MERGED' }),
      pr({ headRefName: 'feat/fork-only', isCrossRepository: true }),
    ]);
    assert.equal(map.get('feat/x')?.number, 3);
    assert.equal(map.has('feat/fork-only'), false);
  });
});

describe('classifyBranch', () => {
  it('removes a merged branch whose tip is the PR head, without archive', () => {
    const d = classifyBranch(idle(30, { worktree: '/wt' }));
    assert.equal(d.action, 'remove');
    assert.equal(d.archive, false);
    assert.equal(d.worktree, '/wt');
    assert.equal(d.reason, 'PR #1 MERGED');
  });

  it('keeps never-touch branches with their reason, however idle', () => {
    const d = classifyBranch(idle(365, { branch: 'main', pr: undefined }));
    assert.deepEqual(d, { action: 'keep', branch: 'main', reason: 'never pruned' });
  });

  it('keeps the worktree the command runs from, however idle', () => {
    const d = classifyBranch(idle(365, { cwdWorktree: '/wt', pr: undefined, worktree: '/wt' }));
    assert.equal(d.action, 'keep');
    assert.match(d.reason, /current worktree/);
  });

  it('keeps a worktree whose status cannot be read, however idle', () => {
    const d = classifyBranch(idle(365, { readStatus: () => null, worktree: '/wt' }));
    assert.equal(d.action, 'keep');
    assert.match(d.reason, /can't be read/);
  });

  it('keeps open PRs, however idle', () => {
    const d = classifyBranch(idle(365, { pr: pr({ state: 'OPEN' }) }));
    assert.deepEqual(d, { action: 'keep', branch: 'feat/x', reason: 'PR #1 OPEN' });
  });

  it('keeps an unknown PR state', () => {
    assert.equal(classifyBranch(idle(365, { pr: pr({ state: 'DRAFT' }) })).action, 'keep');
  });

  it('keeps a branch whose PR lookup failed', () => {
    const d = classifyBranch(idle(365, { pr: undefined, prUnknown: true }));
    assert.equal(d.action, 'keep');
    assert.match(d.reason, /PR lookup failed/);
  });

  it('ignores a recent branch without a PR and says when it will go', () => {
    const d = classifyBranch(idle(2, { pr: undefined }));
    assert.equal(d.action, 'ignore');
    assert.equal(d.reason, 'no PR; idle 2d, archived and removed after 7d idle');
  });

  it('archives and removes a branch without a PR idle longer than staleDays', () => {
    const d = classifyBranch(idle(8, { pr: undefined, worktree: '/wt' }));
    assert.equal(d.action, 'remove');
    assert.equal(d.archive, true);
    assert.equal(d.pr, undefined);
    assert.equal(d.worktree, '/wt');
    assert.equal(d.reason, 'no PR, idle 8d');
  });

  it('parks a branch without a PR under a keep prefix, however idle', () => {
    const d = classifyBranch(idle(365, { branch: 'park/idea', pr: undefined }));
    assert.deepEqual(d, {
      action: 'ignore',
      branch: 'park/idea',
      reason: 'no PR, parked under park/',
    });
    const custom = classifyBranch(
      idle(365, { branch: 'spike/a', keepPrefixes: ['spike/'], pr: undefined }),
    );
    assert.equal(custom.action, 'ignore');
    assert.equal(
      classifyBranch(idle(365, { branch: 'park/x', keepPrefixes: [], pr: undefined })).action,
      'remove',
    );
  });

  it('a parked name with a merged PR follows the PR rules', () => {
    const d = classifyBranch(idle(1, { branch: 'park/x', pr: pr({ headRefName: 'park/x' }) }));
    assert.equal(d.action, 'remove');
    assert.equal(d.archive, false);
  });

  it('keeps a recent merged branch whose local tip moved, then archives it once stale', () => {
    const recent = classifyBranch(idle(3, { tip: 'b'.repeat(40) }));
    assert.equal(recent.action, 'keep');
    assert.match(
      recent.reason,
      /local tip is not the PR head; idle 3d, archived and removed after 7d idle/,
    );
    const stale = classifyBranch(idle(10, { tip: 'b'.repeat(40) }));
    assert.equal(stale.action, 'remove');
    assert.equal(stale.archive, true);
    assert.equal(stale.dirty, false);
    assert.match(stale.reason, /local tip is not the PR head, idle 10d/);
  });

  it('keeps a recent dirty worktree of a merged or closed PR, then archives it once stale', () => {
    for (const state of ['MERGED', 'CLOSED']) {
      const over = {
        includeClosed: true,
        pr: pr({ state }),
        readStatus: () => ' M a.txt\n',
        worktree: '/wt',
      };
      const recent = classifyBranch(idle(1, over));
      assert.equal(recent.action, 'keep');
      assert.match(recent.reason, /uncommitted changes; idle 1d/);
      const stale = classifyBranch(idle(8, over));
      assert.equal(stale.action, 'remove');
      assert.equal(stale.archive, true);
      assert.equal(stale.dirty, true);
    }
  });

  it('closed PRs: removed now with includeClosed, archived once stale without it', () => {
    const closed = pr({ state: 'CLOSED' });
    const kept = classifyBranch(idle(3, { pr: closed }));
    assert.equal(kept.action, 'keep');
    assert.match(kept.reason, /--include-closed/);
    const now = classifyBranch(idle(3, { includeClosed: true, pr: closed }));
    assert.equal(now.action, 'remove');
    assert.equal(now.archive, false);
    const stale = classifyBranch(idle(8, { pr: closed }));
    assert.equal(stale.action, 'remove');
    assert.equal(stale.archive, true);
  });

  it('honours staleDays, strictly longer than the threshold', () => {
    assert.equal(DEFAULT_STALE_DAYS, 7);
    assert.equal(classifyBranch(idle(7, { pr: undefined })).action, 'ignore');
    assert.equal(
      classifyBranch(base({ lastActivity: NOW - 7 * DAY - 1, pr: undefined })).action,
      'remove',
    );
    assert.equal(classifyBranch(idle(2, { pr: undefined, staleDays: 1 })).action, 'remove');
    assert.equal(classifyBranch(idle(20, { pr: undefined, staleDays: 30 })).action, 'ignore');
  });
});

describe('stale helpers', () => {
  it('idleDays floors and never goes negative', () => {
    assert.equal(idleDays(NOW, NOW - 1.9 * DAY), 1);
    assert.equal(idleDays(NOW, NOW + DAY), 0);
  });

  it('archiveDate is YYYY-MM-DD', () => {
    assert.match(archiveDate(NOW), /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(archiveDate(new Date(2026, 0, 5, 10).getTime()), '2026-01-05');
  });

  it('parseStatusPaths reads -z output and skips rename sources', () => {
    const z = [
      ' M src/a.ts',
      'R  new name.ts',
      'old name.ts',
      '?? untracked/b.txt',
      ' D gone.ts',
      '',
    ].join('\0');
    assert.deepEqual(parseStatusPaths(z), [
      'src/a.ts',
      'new name.ts',
      'untracked/b.txt',
      'gone.ts',
    ]);
  });
});

describe('loadPruneConfig', () => {
  const withPkg = async (pkg, fn) => {
    const dir = mkdtempSync(join(tmpdir(), 'wt-prune-cfg-'));
    try {
      if (pkg !== undefined) writeFileSync(join(dir, 'package.json'), pkg);
      await fn(dir);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  };

  it('works without package.json', () =>
    withPkg(undefined, async (dir) => {
      assert.deepEqual(await loadPruneConfig(dir), { cfg: null, protectedBranches: [] });
    }));

  it('works without a worktree field', () =>
    withPkg('{"name":"x"}', async (dir) => {
      assert.deepEqual(await loadPruneConfig(dir), { cfg: null, protectedBranches: [] });
    }));

  it('reads prune.protected from a prune-only config', () =>
    withPkg('{"worktree":{"prune":{"protected":["test/keep"]}}}', async (dir) => {
      assert.deepEqual(await loadPruneConfig(dir), {
        cfg: null,
        protectedBranches: ['test/keep'],
      });
    }));

  it('loads the full config when services are declared', () =>
    withPkg(
      JSON.stringify({
        worktree: {
          directoryPrefix: 'x',
          portRegistry: '/tmp/x.json',
          services: [
            { featureBase: 2, logPrefix: 'x', mainPort: 1, name: 'site', pnpmFilter: 'x' },
          ],
        },
      }),
      async (dir) => {
        const { cfg } = await loadPruneConfig(dir);
        assert.equal(cfg?.directoryPrefix, 'x');
      },
    ));

  it('reads staleDays, keepPrefixes and archiveDir', () =>
    withPkg(
      '{"worktree":{"prune":{"staleDays":14,"keepPrefixes":["park/","spike/"],"archiveDir":"/tmp/a"}}}',
      async (dir) => {
        assert.deepEqual(await loadPruneConfig(dir), {
          archiveDir: '/tmp/a',
          cfg: null,
          keepPrefixes: ['park/', 'spike/'],
          protectedBranches: [],
          staleDays: 14,
        });
      },
    ));

  it('rejects invalid staleDays, keepPrefixes and archiveDir', async () => {
    for (const [prune, message] of [
      [{ staleDays: -1 }, /staleDays/],
      [{ staleDays: '7' }, /staleDays/],
      [{ keepPrefixes: 'park/' }, /keepPrefixes/],
      [{ archiveDir: '' }, /archiveDir/],
    ]) {
      await withPkg(JSON.stringify({ worktree: { prune } }), async (dir) => {
        await assert.rejects(loadPruneConfig(dir), message);
      });
    }
  });

  it('rejects a non-array protected list', () =>
    withPkg('{"worktree":{"prune":{"protected":"main"}}}', async (dir) => {
      await assert.rejects(loadPruneConfig(dir), /must be an array/);
    }));

  it('rejects invalid JSON', () =>
    withPkg('{', async (dir) => {
      await assert.rejects(loadPruneConfig(dir), /Failed to parse/);
    }));
});

describe('deleteRemoteBranchViaApi', () => {
  it('deletes the ref through gh api, not git push (no pre-push hook)', () => {
    const calls = [];
    deleteRemoteBranchViaApi('Org/repo', 'feat/x', (cmd, args) => {
      calls.push([cmd, ...args]);
      return '';
    });
    assert.deepEqual(calls, [
      ['gh', 'api', '-X', 'DELETE', 'repos/Org/repo/git/refs/heads/feat/x'],
    ]);
  });
});
