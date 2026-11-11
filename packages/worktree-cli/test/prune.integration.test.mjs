/**
 * Integration tests for `prune` against a real temp git repo with a bare
 * `origin`. `gh` is replaced by a fixed PR list (the `pullRequests` option),
 * whose head SHAs come from the commits created here.
 */
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { prune } from '../dist/index.js';

const git = (cwd, ...args) =>
  execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

function makeRepo() {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'wt-prune-')));
  const origin = join(base, 'origin.git');
  const root = join(base, 'repo');
  execFileSync('git', ['init', '-q', '--bare', '--initial-branch=main', origin]);
  execFileSync('git', ['init', '-q', '--initial-branch=main', root]);
  git(root, 'config', 'user.email', 'test@local');
  git(root, 'config', 'user.name', 'test');
  git(root, 'config', 'commit.gpgsign', 'false');
  writeFileSync(join(root, 'README'), 'fixture\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'init');
  git(root, 'remote', 'add', 'origin', origin);
  git(root, 'push', '-q', 'origin', 'main');
  return { base, origin, root };
}

/** Create `name` with its own commit on top of main; returns the tip SHA. */
function branch(root, name, parent = 'main') {
  const sha = git(root, 'commit-tree', 'HEAD^{tree}', '-p', parent, '-m', name);
  git(root, 'branch', '-f', name, sha);
  return sha;
}

function worktree(repo, name) {
  const path = join(repo.base, `wt-${name.replace(/\//g, '-')}`);
  git(repo.root, 'worktree', 'add', '-q', path, name);
  return path;
}

const localBranches = (root) =>
  git(root, 'for-each-ref', '--format=%(refname:short)', 'refs/heads/').split('\n').sort();

const remoteBranches = (origin) =>
  git(origin, 'for-each-ref', '--format=%(refname:short)', 'refs/heads/').split('\n').sort();

let nextPr = 1;
const pr = (headRefName, headRefOid, state = 'MERGED', over = {}) => ({
  headRefName,
  headRefOid,
  isCrossRepository: false,
  number: nextPr++,
  state,
  ...over,
});

async function run(repo, opts) {
  const lines = [];
  const result = await prune({
    cwdWorktree: repo.root,
    mainRoot: repo.root,
    out: (l) => lines.push(l),
    err: (l) => lines.push(`stderr: ${l}`),
    ...opts,
  });
  return { lines, result, text: lines.join('\n') };
}

const lineFor = (text, prefix, branchName) =>
  text.split('\n').find((l) => l.startsWith(prefix) && l.includes(` ${branchName} `)) ??
  text.split('\n').find((l) => l.startsWith(prefix) && l.includes(branchName));

describe('prune (local branches)', () => {
  it('dry run lists, --yes removes only what is safe, --include-closed adds closed PRs', async () => {
    const repo = makeRepo();
    try {
      const { root } = repo;
      const prs = [];
      prs.push(pr('feat/merged-wt', branch(root, 'feat/merged-wt')));
      const mergedWt = worktree(repo, 'feat/merged-wt');
      prs.push(pr('feat/merged', branch(root, 'feat/merged')));
      prs.push(pr('feat/open', branch(root, 'feat/open'), 'OPEN'));
      prs.push(pr('feat/closed', branch(root, 'feat/closed'), 'CLOSED'));
      branch(root, 'feat/nopr');
      prs.push(pr('feat/nopr', 'f'.repeat(40), 'MERGED', { isCrossRepository: true }));
      const oldTip = branch(root, 'feat/moved');
      prs.push(pr('feat/moved', oldTip));
      branch(root, 'feat/moved', oldTip); // a commit after the merge
      prs.push(pr('feat/dirty', branch(root, 'feat/dirty')));
      writeFileSync(join(worktree(repo, 'feat/dirty'), 'new.txt'), 'wip\n');
      prs.push(pr('keep/me', branch(root, 'keep/me')));
      const reusedTip = branch(root, 'feat/reused');
      prs.push(pr('feat/reused', reusedTip));
      prs.push(pr('feat/reused', reusedTip, 'OPEN')); // newer PR, same name

      const pullRequests = { defaultBranch: 'main', pullRequests: prs };
      const opts = { protectedBranches: ['keep/me'], pullRequests };
      const before = localBranches(root);

      const dry = await run(repo, opts);
      assert.deepEqual(localBranches(root), before, 'dry run changes nothing');
      assert.deepEqual(dry.result, { failed: 0, kept: 8, removed: 2 });
      assert.match(lineFor(dry.text, 'would remove', 'feat/merged-wt'), new RegExp(mergedWt));
      assert.match(
        lineFor(dry.text, 'would remove', 'feat/merged'),
        /PR #\d+ MERGED, tip [0-9a-f]{7}/,
      );
      assert.match(lineFor(dry.text, 'kept', 'feat/open'), /OPEN/);
      assert.match(lineFor(dry.text, 'kept', 'feat/closed'), /--include-closed/);
      assert.match(lineFor(dry.text, 'ignored', 'feat/nopr'), /no PR/);
      assert.match(lineFor(dry.text, 'kept', 'feat/moved'), /local tip is not the PR head/);
      assert.match(lineFor(dry.text, 'kept', 'feat/dirty'), /uncommitted changes/);
      assert.match(lineFor(dry.text, 'kept', 'keep/me'), /protected/);
      assert.match(lineFor(dry.text, 'kept', 'feat/reused'), /OPEN/);
      assert.match(lineFor(dry.text, 'kept', 'main'), /main checkout/);
      assert.match(dry.text, /Run with --yes to apply/);

      const applied = await run(repo, { ...opts, apply: true });
      assert.deepEqual(applied.result, { failed: 0, kept: 8, removed: 2 });
      assert.ok(!existsSync(mergedWt), 'worktree removed');
      assert.ok(lineFor(applied.text, 'removed', 'feat/merged-wt'));
      const after = localBranches(root);
      assert.ok(!after.includes('feat/merged-wt'));
      assert.ok(!after.includes('feat/merged'));
      for (const b of [
        'main',
        'feat/open',
        'feat/closed',
        'feat/nopr',
        'feat/moved',
        'feat/dirty',
        'keep/me',
        'feat/reused',
      ]) {
        assert.ok(after.includes(b), `${b} kept`);
      }

      const closed = await run(repo, { ...opts, apply: true, includeClosed: true });
      assert.equal(closed.result.removed, 1);
      assert.ok(!localBranches(root).includes('feat/closed'));
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });

  it('reports a failed worktree removal, keeps the branch and counts the failure', async () => {
    const repo = makeRepo();
    try {
      const { root } = repo;
      const prs = [pr('feat/locked', branch(root, 'feat/locked'))];
      const path = worktree(repo, 'feat/locked');
      git(root, 'worktree', 'lock', path);

      const { result, text } = await run(repo, {
        apply: true,
        pullRequests: { pullRequests: prs },
      });
      assert.equal(result.failed, 1);
      assert.match(lineFor(text, 'FAILED', 'feat/locked'), /was not removed, nothing was deleted/);
      assert.ok(existsSync(path));
      assert.ok(localBranches(root).includes('feat/locked'));
      git(root, 'worktree', 'unlock', path);
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });

  it('keeps the worktree the command runs from', async () => {
    const repo = makeRepo();
    try {
      const prs = [pr('feat/here', branch(repo.root, 'feat/here'))];
      const path = worktree(repo, 'feat/here');
      const { result, text } = await run(repo, {
        apply: true,
        cwdWorktree: path,
        pullRequests: { pullRequests: prs },
      });
      assert.equal(result.removed, 0);
      assert.match(lineFor(text, 'kept', 'feat/here'), /current worktree/);
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });

  it('frees the registry slot and log files of a configured repo', async () => {
    const repo = makeRepo();
    const logPrefix = `wt-prune-test-${process.pid}-${Date.now()}`;
    const logPath = `/tmp/${logPrefix}-feat-slot.log`;
    try {
      const prs = [pr('feat/slot', branch(repo.root, 'feat/slot'))];
      worktree(repo, 'feat/slot');
      const portRegistry = join(repo.base, 'ports.json');
      writeFileSync(
        portRegistry,
        JSON.stringify({ 'feat/slot': { ports: { api: 59991 }, slot: 1 } }),
      );
      writeFileSync(logPath, 'log\n');
      const cfg = {
        directoryPrefix: 'fixture',
        portRegistry,
        services: [
          { featureBase: 59991, logPrefix, mainPort: 59990, name: 'api', pnpmFilter: 'fixture' },
        ],
      };

      const dry = await run(repo, { cfg, pullRequests: { pullRequests: prs } });
      assert.match(lineFor(dry.text, 'would remove', 'feat/slot'), /frees slot 1/);

      const { result } = await run(repo, { apply: true, cfg, pullRequests: { pullRequests: prs } });
      assert.equal(result.removed, 1);
      assert.deepEqual(JSON.parse(readFileSync(portRegistry, 'utf-8')), {});
      assert.ok(!existsSync(logPath), 'log removed');
    } finally {
      rmSync(logPath, { force: true });
      rmSync(repo.base, { force: true, recursive: true });
    }
  });
});

describe('prune --remote', () => {
  it('deletes remote branches of merged PRs whose remote tip is the PR head', async () => {
    const repo = makeRepo();
    try {
      const { origin, root } = repo;
      const prs = [];
      const mergedTip = branch(root, 'feat/r-merged');
      prs.push(pr('feat/r-merged', mergedTip));
      const movedTip = branch(root, 'feat/r-moved');
      prs.push(pr('feat/r-moved', movedTip));
      branch(root, 'feat/r-moved', movedTip);
      prs.push(pr('feat/r-open', branch(root, 'feat/r-open'), 'OPEN'));
      prs.push(pr('feat/r-closed', branch(root, 'feat/r-closed'), 'CLOSED'));
      prs.push(pr('main', git(root, 'rev-parse', 'main')));
      git(
        root,
        'push',
        '-q',
        'origin',
        'feat/r-merged',
        'feat/r-moved',
        'feat/r-open',
        'feat/r-closed',
      );
      // Local copies go away so only the remote pass is exercised.
      git(root, 'branch', '-D', 'feat/r-merged', 'feat/r-moved', 'feat/r-open', 'feat/r-closed');

      // The API call is swapped for a delete on the local origin.
      const deleted = [];
      const opts = {
        deleteRemoteBranch: (b) => {
          deleted.push(b);
          git(root, 'push', '-q', 'origin', '--delete', b);
        },
        pullRequests: { defaultBranch: 'main', pullRequests: prs },
        remote: true,
      };
      const dry = await run(repo, opts);
      assert.match(lineFor(dry.text, 'would remove', 'origin/feat/r-merged'), /tip [0-9a-f]{7}/);
      assert.match(
        lineFor(dry.text, 'kept', 'origin/feat/r-moved'),
        /remote tip is not the PR head/,
      );
      assert.match(lineFor(dry.text, 'kept', 'origin/main'), /main/);
      assert.equal(lineFor(dry.text, '', 'origin/feat/r-open'), undefined);
      assert.equal(lineFor(dry.text, '', 'origin/feat/r-closed'), undefined);

      const applied = await run(repo, { ...opts, apply: true });
      assert.equal(applied.result.failed, 0);
      assert.deepEqual(remoteBranches(origin), [
        'feat/r-closed',
        'feat/r-moved',
        'feat/r-open',
        'main',
      ]);

      await run(repo, { ...opts, apply: true, includeClosed: true });
      assert.deepEqual(remoteBranches(origin), ['feat/r-moved', 'feat/r-open', 'main']);
      assert.deepEqual(deleted, ['feat/r-merged', 'feat/r-closed']);
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });

  it('without the GitHub repo, nothing remote is deleted and the line says why', async () => {
    const repo = makeRepo();
    try {
      const { root, origin } = repo;
      const tip = branch(root, 'feat/r-orphan');
      git(root, 'push', '-q', 'origin', 'feat/r-orphan');
      git(root, 'branch', '-D', 'feat/r-orphan');
      const { result, text } = await run(repo, {
        apply: true,
        pullRequests: { defaultBranch: 'main', pullRequests: [pr('feat/r-orphan', tip)] },
        remote: true,
      });
      assert.equal(result.failed, 1);
      assert.match(text, /GitHub repo is unknown/);
      assert.ok(remoteBranches(origin).includes('feat/r-orphan'));
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });

  it('counts a missing origin as a failure', async () => {
    const repo = makeRepo();
    try {
      git(repo.root, 'remote', 'remove', 'origin');
      const { result, text } = await run(repo, {
        pullRequests: { pullRequests: [] },
        remote: true,
      });
      assert.equal(result.failed, 1);
      assert.match(text, /could not list the branches on origin/);
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });
});
