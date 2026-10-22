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
  classifyBranch,
  deleteRemoteBranchViaApi,
  latestPullRequests,
  loadPruneConfig,
  parseWorktreeList,
} from '../dist/index.js';

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
  neverTouch: new Map([['main', 'never pruned']]),
  pr: pr(),
  readStatus: () => '',
  tip: 'a'.repeat(40),
  ...over,
});

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
    ].join('\n');
    assert.deepEqual(parseWorktreeList(out), [
      { branch: 'main', path: '/repo' },
      { branch: 'feat/a', path: '/repo-feat-a' },
      { path: '/repo-detached' },
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
  it('removes a merged branch whose tip is the PR head', () => {
    const d = classifyBranch(base({ worktree: '/wt' }));
    assert.equal(d.action, 'remove');
    assert.equal(d.worktree, '/wt');
  });

  it('keeps never-touch branches with their reason', () => {
    const d = classifyBranch(base({ branch: 'main' }));
    assert.deepEqual(d, { action: 'keep', branch: 'main', reason: 'never pruned' });
  });

  it('ignores a branch without a PR', () => {
    const d = classifyBranch(base({ pr: undefined }));
    assert.equal(d.action, 'ignore');
  });

  it('keeps open PRs', () => {
    assert.equal(classifyBranch(base({ pr: pr({ state: 'OPEN' }) })).action, 'keep');
  });

  it('keeps closed PRs unless includeClosed', () => {
    const closed = pr({ state: 'CLOSED' });
    const kept = classifyBranch(base({ pr: closed }));
    assert.equal(kept.action, 'keep');
    assert.match(kept.reason, /--include-closed/);
    assert.equal(classifyBranch(base({ includeClosed: true, pr: closed })).action, 'remove');
  });

  it('keeps an unknown PR state', () => {
    assert.equal(classifyBranch(base({ pr: pr({ state: 'DRAFT' }) })).action, 'keep');
  });

  it('keeps a branch whose local tip moved past the PR head', () => {
    const d = classifyBranch(base({ tip: 'b'.repeat(40) }));
    assert.equal(d.action, 'keep');
    assert.match(d.reason, /local tip is not the PR head/);
  });

  it('keeps a dirty worktree and one whose status cannot be read', () => {
    const dirty = classifyBranch(base({ readStatus: () => '?? new.txt\n', worktree: '/wt' }));
    assert.match(dirty.reason, /uncommitted changes/);
    const unreadable = classifyBranch(base({ readStatus: () => null, worktree: '/wt' }));
    assert.match(unreadable.reason, /can't be read/);
  });

  it('keeps the worktree the command runs from', () => {
    const d = classifyBranch(base({ cwdWorktree: '/wt', worktree: '/wt' }));
    assert.equal(d.action, 'keep');
    assert.match(d.reason, /current worktree/);
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
