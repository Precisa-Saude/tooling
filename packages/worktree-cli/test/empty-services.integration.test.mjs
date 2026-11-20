/**
 * Repositórios só de biblioteca (datasus-dbc, datasus-sdk, pns) declaram
 * `"services": []`: sem servidor de desenvolvimento, sem portas. Estes testes
 * rodam cada comando do CLI contra repositórios git temporários. O registro de
 * portas aponta sempre para o diretório temporário do teste.
 */
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { loadConfig, loadPruneConfig, prune, setup, teardown } from '../dist/index.js';
import { cli, fakeGh } from './cli-fixtures.mjs';

const git = (cwd, ...args) =>
  execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

/**
 * Repositório com `origin` vazio e o bloco `worktree` no formato dos três
 * repositórios de biblioteca, com `install: false` para não rodar o pnpm.
 */
function makeRepo() {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'wt-sem-servicos-')));
  const origin = join(base, 'origin.git');
  const root = join(base, 'lib');
  const portRegistry = join(base, 'ports.json');
  const cfg = {
    directoryPrefix: 'lib',
    portRegistry,
    buildCommand: 'echo construido > construido.txt',
    install: false,
    services: [],
  };
  execFileSync('git', ['init', '-q', '--bare', '--initial-branch=main', origin]);
  execFileSync('git', ['init', '-q', '--initial-branch=main', root]);
  git(root, 'config', 'user.email', 'test@local');
  git(root, 'config', 'user.name', 'test');
  git(root, 'config', 'commit.gpgsign', 'false');
  writeFileSync(join(root, 'package.json'), `${JSON.stringify({ worktree: cfg }, null, 2)}\n`);
  writeFileSync(join(root, '.gitignore'), 'construido.txt\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'init');
  git(root, 'remote', 'add', 'origin', origin);
  git(root, 'push', '-q', 'origin', 'main');
  return { base, cfg, portRegistry, root };
}

const localBranches = (root) =>
  git(root, 'for-each-ref', '--format=%(refname:short)', 'refs/heads/').split('\n').sort();

const worktreePaths = (root) =>
  git(root, 'worktree', 'list', '--porcelain')
    .split('\n')
    .filter((l) => l.startsWith('worktree '))
    .map((l) => l.slice('worktree '.length));

/**
 * Roda `fn` com o console capturado (o `buildCommand` herda o stdout, que
 * continua no terminal) e devolve o que foi impresso.
 */
async function quiet(fn) {
  const { error, log } = console;
  const lines = [];
  console.log = (...a) => lines.push(a.join(' '));
  console.error = (...a) => lines.push(a.join(' '));
  try {
    await fn();
  } finally {
    console.log = log;
    console.error = error;
  }
  return lines.join('\n');
}

const ok = (res) => assert.equal(res.status, 0, `stdout: ${res.stdout}\nstderr: ${res.stderr}`);

describe('configuração com "services": []', () => {
  it('loadConfig aceita a lista vazia', async () => {
    const repo = makeRepo();
    try {
      const cfg = await loadConfig(repo.root);
      assert.deepEqual(cfg.services, []);
      assert.equal(cfg.directoryPrefix, 'lib');
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });

  it('loadPruneConfig devolve a configuração completa, não um erro', async () => {
    const repo = makeRepo();
    try {
      const { cfg } = await loadPruneConfig(repo.root);
      assert.deepEqual(cfg?.services, []);
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });

  it('os demais campos obrigatórios continuam validados', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wt-sem-servicos-cfg-'));
    const svc = { featureBase: 2, logPrefix: 'x', mainPort: 1, name: 'site', pnpmFilter: 'x' };
    try {
      for (const [worktree, message] of [
        [{ portRegistry: '/p.json', services: [] }, /directoryPrefix is required/],
        [{ directoryPrefix: 'x', services: [] }, /portRegistry is required/],
        [{ name: undefined }, /service\.name is required/],
        [{ pnpmFilter: '' }, /pnpmFilter is required/],
        [{ logPrefix: '' }, /logPrefix is required/],
        [{ mainPort: '1' }, /mainPort must be a number/],
        [{ featureBase: null }, /featureBase must be a number/],
      ]) {
        const cfg =
          'services' in worktree
            ? worktree
            : {
                directoryPrefix: 'x',
                portRegistry: '/p.json',
                services: [{ ...svc, ...worktree }],
              };
        writeFileSync(join(dir, 'package.json'), JSON.stringify({ worktree: cfg }));
        await assert.rejects(loadConfig(dir), message);
      }
      writeFileSync(join(dir, 'package.json'), '{"name":"sem-worktree"}');
      await assert.rejects(loadConfig(dir), /No "worktree" field/);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it('services ausente ou que não é lista continua sendo erro', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wt-sem-servicos-cfg-'));
    try {
      for (const services of [undefined, {}, 'api']) {
        const worktree = { directoryPrefix: 'x', portRegistry: join(dir, 'p.json'), services };
        writeFileSync(join(dir, 'package.json'), JSON.stringify({ worktree }));
        await assert.rejects(loadConfig(dir), /worktree\.services/);
      }
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });
});

describe('comandos num repositório sem serviços', () => {
  it('setup, list, dev, stop, logs e teardown saem com 0 e não criam o registro', () => {
    const repo = makeRepo();
    const { root } = repo;
    const path = join(repo.base, 'lib-feat-biblioteca');
    try {
      const setup = cli(root, ['setup', 'feat/biblioteca']);
      ok(setup);
      assert.ok(existsSync(join(path, 'construido.txt')), 'buildCommand rodou no worktree');
      assert.match(setup.stdout, /Worktree ready/);
      assert.match(setup.stdout, /no dev servers/);
      assert.doesNotMatch(setup.stdout, /localhost/);
      assert.deepEqual(worktreePaths(root), [root, path]);

      const list = cli(root, ['list']);
      ok(list);
      assert.match(list.stdout, /feat\/biblioteca/);
      assert.ok(list.stdout.includes(path), `list mostra o caminho: ${list.stdout}`);

      // De dentro do worktree, com a branch detectada, e do checkout principal sem branch.
      for (const [cwd, args] of [
        [path, ['dev']],
        [path, ['dev', '--detach']],
        [root, ['dev']],
        [path, ['stop']],
        [root, ['stop']],
        [path, ['logs']],
        [root, ['logs']],
        [root, ['logs', 'feat/biblioteca']],
      ]) {
        const res = cli(cwd, args);
        ok(res);
        assert.match(res.stdout, /no dev servers \(worktree\.services is empty\): nothing to/);
      }

      const teardown = cli(root, ['teardown', 'feat/biblioteca']);
      ok(teardown);
      assert.ok(!existsSync(path), 'worktree removido');
      assert.deepEqual(localBranches(root), ['main']);

      assert.ok(!existsSync(repo.portRegistry), 'nenhum comando criou o registro de portas');
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });

  it('setup e teardown em processo não reservam portas nem tocam o registro', async () => {
    const repo = makeRepo();
    const path = join(repo.base, 'lib-feat-em-processo');
    try {
      const out = await quiet(() =>
        setup({ branch: 'feat/em-processo', cfg: repo.cfg, repoRoot: repo.root }),
      );
      assert.match(out, /No ports reserved: no dev servers/);
      assert.ok(existsSync(join(path, 'construido.txt')));

      await quiet(() =>
        teardown({ branch: 'feat/em-processo', cfg: repo.cfg, repoRoot: repo.root }),
      );
      assert.ok(!existsSync(path), 'worktree removido');
      assert.deepEqual(localBranches(repo.root), ['main']);
      assert.ok(!existsSync(repo.portRegistry), 'registro de portas não criado');
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });

  it('prune pelo CLI lista e remove o worktree do PR mesclado', () => {
    const repo = makeRepo();
    const { root } = repo;
    const path = join(repo.base, 'lib-feat-mesclada');
    try {
      ok(cli(root, ['setup', 'feat/mesclada']));
      const tip = git(root, 'rev-parse', 'feat/mesclada');
      const env = fakeGh(repo.base, [
        {
          headRefName: 'feat/mesclada',
          headRefOid: tip,
          isCrossRepository: false,
          number: 7,
          state: 'MERGED',
        },
      ]);

      const dry = cli(root, ['prune'], env);
      ok(dry);
      assert.match(dry.stdout, /would remove\s+feat\/mesclada \(PR #7 MERGED/);
      assert.ok(existsSync(path), 'o ensaio não remove nada');

      const applied = cli(root, ['prune', '--yes'], env);
      ok(applied);
      assert.match(applied.stdout, /removed\s+feat\/mesclada/);
      assert.ok(!existsSync(path), 'worktree removido');
      assert.deepEqual(localBranches(root), ['main']);
      assert.ok(!existsSync(repo.portRegistry), 'prune não criou o registro de portas');
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });

  it('prune em processo usa a configuração sem serviços', async () => {
    const repo = makeRepo();
    try {
      const { cfg, protectedBranches } = await loadPruneConfig(repo.root);
      const lines = [];
      const result = await prune({
        cfg,
        cwdWorktree: repo.root,
        mainRoot: repo.root,
        out: (l) => lines.push(l),
        protectedBranches,
        pullRequests: { defaultBranch: 'main', pullRequests: [] },
      });
      assert.equal(result.failed, 0, lines.join('\n'));
      assert.ok(!existsSync(repo.portRegistry));
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });
});
