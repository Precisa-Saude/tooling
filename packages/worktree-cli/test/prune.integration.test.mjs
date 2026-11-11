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

import { archiveDate, prune } from '../dist/index.js';

const DAY = 86_400_000;
/** Far enough ahead that everything created by a test is stale. */
const LATER = Date.now() + 30 * DAY;

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
  git(root, 'config', 'tag.gpgSign', 'false');
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
      assert.deepEqual(dry.result, { failed: 0, freed: 0, kept: 8, removed: 2 });
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
      assert.deepEqual(applied.result, { failed: 0, freed: 0, kept: 8, removed: 2 });
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

      const opts = { pullRequests: { defaultBranch: 'main', pullRequests: prs }, remote: true };
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

const tags = (root) => git(root, 'tag', '--list', 'archive/*').split('\n').filter(Boolean).sort();

describe('prune (stale branches)', () => {
  it('archives a stale branch with a tag, a patch and the untracked files, then removes it', async () => {
    const repo = makeRepo();
    try {
      const { root } = repo;
      const archiveDir = join(repo.base, 'archive');
      const date = archiveDate(LATER);
      const prs = [];

      const noPrTip = branch(root, 'feat/nopr');
      const noPrWt = worktree(repo, 'feat/nopr');
      writeFileSync(join(noPrWt, 'README'), 'fixture\nwork in progress\n');
      writeFileSync(join(noPrWt, 'notes.txt'), 'untracked\n');

      const movedTip = branch(root, 'feat/moved');
      prs.push(pr('feat/moved', movedTip));
      const movedNow = branch(root, 'feat/moved', movedTip);

      branch(root, 'park/idea');
      prs.push(pr('feat/open', branch(root, 'feat/open'), 'OPEN'));
      branch(root, 'feat/recent');

      const opts = { archiveDir, now: LATER, pullRequests: { pullRequests: prs } };
      const before = localBranches(root);

      const dry = await run(repo, opts);
      assert.deepEqual(localBranches(root), before, 'dry run changes nothing');
      assert.deepEqual(tags(root), [], 'dry run creates no tag');
      assert.ok(!existsSync(archiveDir), 'dry run writes no archive');
      assert.match(
        lineFor(dry.text, 'would remove', 'feat/nopr'),
        new RegExp(
          `no PR, idle \\d+d.*archives as archive/${date}/feat/nopr plus the uncommitted changes`,
        ),
      );
      assert.match(
        lineFor(dry.text, 'would remove', 'feat/moved'),
        /local tip is not the PR head, idle \d+d.*archives as archive\//,
      );
      assert.match(lineFor(dry.text, 'ignored', 'park/idea'), /parked under park\//);
      assert.match(lineFor(dry.text, 'kept', 'feat/open'), /OPEN/);

      const recent = await run(repo, { ...opts, now: Date.now() });
      assert.match(
        lineFor(recent.text, 'ignored', 'feat/recent'),
        /no PR; idle 0d, archived and removed after 7d idle/,
      );

      const applied = await run(repo, { ...opts, apply: true });
      assert.equal(applied.result.failed, 0);
      const patch = join(archiveDir, date, 'feat__nopr.patch');
      const untracked = join(archiveDir, date, 'feat__nopr.untracked.tgz');
      const removedLine = lineFor(applied.text, 'removed', 'feat/nopr');
      assert.match(removedLine, new RegExp(`archived as archive/${date}/feat/nopr`));
      assert.ok(removedLine.includes(`patch ${patch}`));
      assert.ok(removedLine.includes(`untracked ${untracked}`));
      assert.ok(!existsSync(noPrWt), 'dirty worktree removed');

      const after = localBranches(root);
      for (const b of ['feat/nopr', 'feat/moved', 'feat/recent']) assert.ok(!after.includes(b));
      for (const b of ['main', 'park/idea', 'feat/open']) assert.ok(after.includes(b));

      assert.deepEqual(tags(root), [
        `archive/${date}/feat/moved`,
        `archive/${date}/feat/nopr`,
        `archive/${date}/feat/recent`,
      ]);
      assert.equal(git(root, 'rev-parse', `archive/${date}/feat/nopr^{commit}`), noPrTip);
      assert.equal(git(root, 'rev-parse', `archive/${date}/feat/moved^{commit}`), movedNow);
      assert.equal(git(root, 'cat-file', '-t', `archive/${date}/feat/nopr`), 'tag', 'annotated');
      assert.match(
        git(root, 'tag', '-l', '--format=%(contents)', `archive/${date}/feat/nopr`),
        /arquivada/,
      );
      assert.ok(!existsSync(join(archiveDir, date, 'feat__moved.patch')), 'no patch when clean');

      // Restore as the README says.
      git(root, 'worktree', 'add', '-q', '-b', 'feat/nopr', noPrWt, `archive/${date}/feat/nopr`);
      git(noPrWt, 'apply', patch);
      execFileSync('tar', ['-xzf', untracked, '-C', noPrWt]);
      assert.equal(readFileSync(join(noPrWt, 'README'), 'utf-8'), 'fixture\nwork in progress\n');
      assert.equal(readFileSync(join(noPrWt, 'notes.txt'), 'utf-8'), 'untracked\n');
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });

  it('deletes nothing when archiving fails', async () => {
    const repo = makeRepo();
    try {
      const { root } = repo;
      const archiveDir = join(repo.base, 'archive');
      branch(root, 'feat/stuck');
      const path = worktree(repo, 'feat/stuck');
      writeFileSync(join(path, 'wip.txt'), 'wip\n');
      // A signing failure, as when tag.gpgSign is on and gpg can't sign.
      git(root, 'config', 'tag.gpgSign', 'true');
      git(root, 'config', 'gpg.format', 'openpgp');
      git(root, 'config', 'gpg.program', 'false');

      const { result, text } = await run(repo, {
        apply: true,
        archiveDir,
        now: LATER,
        pullRequests: { pullRequests: [] },
      });
      assert.equal(result.failed, 1);
      assert.equal(result.removed, 0);
      assert.match(lineFor(text, 'FAILED', 'feat/stuck'), /archiving failed, nothing was deleted/);
      assert.ok(existsSync(join(path, 'wip.txt')), 'worktree and its work kept');
      assert.ok(localBranches(root).includes('feat/stuck'));
      assert.deepEqual(tags(root), []);
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });
});

describe('prune (PR list over the limit)', () => {
  it('looks up branches missing from a truncated list one by one', async () => {
    const repo = makeRepo();
    try {
      const { root } = repo;
      const oldTip = branch(root, 'feat/old');
      branch(root, 'feat/broken');
      branch(root, 'feat/none');
      const asked = [];
      const lookupPullRequests = (b) => {
        asked.push(b);
        if (b === 'feat/broken') throw new Error('gh: rate limited');
        if (b === 'feat/old')
          return [
            pr('feat/old', oldTip),
            pr('feat/old', oldTip, 'MERGED', { isCrossRepository: true }),
          ];
        return [];
      };

      const { result, text } = await run(repo, {
        apply: true,
        lookupPullRequests,
        now: Date.now(),
        pullRequests: { defaultBranch: 'main', pullRequests: [], truncated: true },
      });
      assert.deepEqual(
        asked.sort(),
        ['feat/broken', 'feat/none', 'feat/old'],
        'main is never looked up',
      );
      assert.match(lineFor(text, 'removed', 'feat/old'), /PR #\d+ MERGED/);
      assert.match(lineFor(text, 'kept', 'feat/broken'), /PR lookup failed/);
      assert.match(
        text,
        /stderr: warning: looking up the PR of feat\/broken failed \(gh: rate limited\)/,
      );
      assert.match(lineFor(text, 'ignored', 'feat/none'), /no PR; idle 0d/);
      assert.equal(result.removed, 1);
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });

  it('does not look anything up when the list is complete', async () => {
    const repo = makeRepo();
    try {
      branch(repo.root, 'feat/none');
      const { text } = await run(repo, {
        lookupPullRequests: () => assert.fail('no lookup expected'),
        pullRequests: { pullRequests: [] },
      });
      assert.match(lineFor(text, 'ignored', 'feat/none'), /no PR/);
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });
});

describe('prune (registry of a configured repo)', () => {
  it('frees the slots of worktrees that are gone', async () => {
    const repo = makeRepo();
    const logPrefix = `wt-prune-gc-${process.pid}-${Date.now()}`;
    const goneLog = `/tmp/${logPrefix}-feat-gone.log`;
    try {
      const { root } = repo;
      branch(root, 'feat/live');
      worktree(repo, 'feat/live');
      branch(root, 'feat/rmdir');
      rmSync(worktree(repo, 'feat/rmdir'), { force: true, recursive: true });
      const portRegistry = join(repo.base, 'ports.json');
      writeFileSync(
        portRegistry,
        JSON.stringify({
          'feat/gone': { ports: { api: 59971 }, slot: 1 },
          'feat/live': { ports: { api: 59981 }, slot: 2 },
          'feat/rmdir': { ports: { api: 59991 }, slot: 3 },
        }),
      );
      writeFileSync(goneLog, 'log\n');
      const cfg = {
        directoryPrefix: 'fixture',
        portRegistry,
        services: [
          {
            featureBase: 59971,
            logPrefix,
            mainPort: 59970,
            name: 'api',
            increment: 10,
            pnpmFilter: 'fixture',
          },
        ],
      };
      const opts = { cfg, now: Date.now(), pullRequests: { pullRequests: [] } };

      const dry = await run(repo, opts);
      assert.equal(dry.result.freed, 2);
      assert.match(dry.text, /would free\s+slot 1 of feat\/gone \(worktree gone\)/);
      assert.match(dry.text, /would free\s+slot 3 of feat\/rmdir \(worktree gone\)/);
      assert.doesNotMatch(dry.text, /slot 2 of feat\/live/);
      assert.equal(Object.keys(JSON.parse(readFileSync(portRegistry, 'utf-8'))).length, 3);

      const applied = await run(repo, { ...opts, apply: true });
      assert.equal(applied.result.freed, 2);
      assert.match(applied.text, /freed\s+slot 1 of feat\/gone \(worktree gone\)/);
      assert.match(applied.text, /freed\s+slot 3 of feat\/rmdir \(worktree gone\)/);
      assert.deepEqual(Object.keys(JSON.parse(readFileSync(portRegistry, 'utf-8'))), ['feat/live']);
      assert.ok(!existsSync(goneLog), 'log removed');
      assert.ok(localBranches(root).includes('feat/rmdir'), 'freeing a slot keeps the branch');
    } finally {
      rmSync(goneLog, { force: true });
      rmSync(repo.base, { force: true, recursive: true });
    }
  });
});

describe('prune --remote (stale)', () => {
  it('archives and deletes a stale remote branch whose tip is not the PR head', async () => {
    const repo = makeRepo();
    try {
      const { base, origin, root } = repo;
      const date = archiveDate(LATER);
      const headTip = branch(root, 'feat/r-moved');
      git(root, 'push', '-q', 'origin', 'feat/r-moved');
      git(root, 'branch', '-D', 'feat/r-moved');
      // Someone else pushes after the merge; the commit is not in this clone.
      const other = join(base, 'other');
      execFileSync('git', ['clone', '-q', '--branch', 'feat/r-moved', origin, other]);
      git(other, 'config', 'user.email', 'test@local');
      git(other, 'config', 'user.name', 'test');
      git(other, 'config', 'commit.gpgsign', 'false');
      git(other, 'commit', '-q', '--allow-empty', '-m', 'after merge');
      git(other, 'push', '-q', 'origin', 'feat/r-moved');
      const remoteTip = git(other, 'rev-parse', 'HEAD');

      const opts = {
        now: LATER,
        pullRequests: { pullRequests: [pr('feat/r-moved', headTip)] },
        remote: true,
      };
      const recent = await run(repo, { ...opts, now: Date.now() });
      assert.match(
        lineFor(recent.text, 'kept', 'origin/feat/r-moved'),
        /remote tip is not the PR head; idle 0d, archived and removed after 7d idle/,
      );

      const dry = await run(repo, opts);
      assert.match(
        lineFor(dry.text, 'would remove', 'origin/feat/r-moved'),
        new RegExp(`archives as archive/${date}/origin__feat/r-moved`),
      );
      assert.deepEqual(remoteBranches(origin), ['feat/r-moved', 'main']);

      const applied = await run(repo, { ...opts, apply: true });
      assert.equal(applied.result.failed, 0);
      assert.match(
        lineFor(applied.text, 'removed', 'origin/feat/r-moved'),
        new RegExp(`archived as archive/${date}/origin__feat/r-moved`),
      );
      assert.deepEqual(remoteBranches(origin), ['main']);
      assert.equal(
        git(root, 'rev-parse', `archive/${date}/origin__feat/r-moved^{commit}`),
        remoteTip,
      );
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });
});
