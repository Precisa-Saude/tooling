/**
 * Testes de integração do `teardown` contra repositórios git temporários.
 * O registro de portas fica sempre no diretório temporário do teste, nunca
 * em `/tmp/*-worktree-ports.json` de um repositório real.
 */
import { strict as assert } from 'node:assert';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { teardown } from '../dist/index.js';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'bin.js');

const git = (cwd, ...args) =>
  execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

/**
 * Repositório com um commit em `main`, `package.json` com a configuração
 * `worktree` e registro de portas próprio em `base/ports.json`.
 */
function makeRepo(registry = {}) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'wt-teardown-')));
  const root = join(base, 'fixture');
  const logPrefix = `wt-teardown-test-${process.pid}-${Date.now()}`;
  const portRegistry = join(base, 'ports.json');
  const cfg = {
    directoryPrefix: 'fixture',
    portRegistry,
    services: [
      { featureBase: 59961, logPrefix, mainPort: 59960, name: 'api', pnpmFilter: 'fixture' },
    ],
  };
  execFileSync('git', ['init', '-q', '--initial-branch=main', root]);
  git(root, 'config', 'user.email', 'test@local');
  git(root, 'config', 'user.name', 'test');
  git(root, 'config', 'commit.gpgsign', 'false');
  writeFileSync(join(root, 'package.json'), `${JSON.stringify({ worktree: cfg }, null, 2)}\n`);
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'init');
  writeFileSync(portRegistry, JSON.stringify(registry));
  return { base, cfg, logPrefix, portRegistry, root };
}

/** Cria `name` com um commit próprio sobre `main`, sem mesclar. */
function branch(root, name) {
  const sha = git(root, 'commit-tree', 'HEAD^{tree}', '-p', 'main', '-m', name);
  git(root, 'branch', '-f', name, sha);
}

/** `git worktree add` direto, como os worktrees criados fora do CLI. */
function plainWorktree(repo, name, dir) {
  const path = join(repo.base, dir);
  git(repo.root, 'worktree', 'add', '-q', path, name);
  return path;
}

const localBranches = (root) =>
  git(root, 'for-each-ref', '--format=%(refname:short)', 'refs/heads/').split('\n').sort();

const worktreePaths = (root) =>
  git(root, 'worktree', 'list', '--porcelain')
    .split('\n')
    .filter((l) => l.startsWith('worktree '))
    .map((l) => l.slice('worktree '.length));

const readRegistry = (repo) => JSON.parse(readFileSync(repo.portRegistry, 'utf-8'));

/**
 * Ambiente do processo filho sem coleta de cobertura. Com
 * `--experimental-test-coverage` o Node passa `NODE_V8_COVERAGE` adiante, e o
 * bundle `dist/bin.js` somaria ao relatório arquivos que só ele carrega. Apagar
 * a chave não basta: o `child_process` a copia de volta de `process.env` a
 * menos que `env` tenha a chave, e o valor `undefined` a deixa de fora.
 */
const childEnv = { ...process.env, NODE_V8_COVERAGE: undefined };

/** Executa o binário a partir do checkout principal, como no relato do bug. */
const cli = (repo, ...args) =>
  spawnSync(process.execPath, [BIN, ...args], {
    cwd: repo.root,
    encoding: 'utf-8',
    env: childEnv,
  });

/** Teardown em processo, com o console silenciado para não poluir a saída do teste. */
async function quiet(fn) {
  const { error, log } = console;
  console.log = () => {};
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.log = log;
    console.error = error;
  }
}

describe('teardown de worktree fora do registro', () => {
  it('remove o worktree achado pelo git e apaga a branch', async () => {
    const repo = makeRepo();
    try {
      branch(repo.root, 'feat/catalogo-lacunas');
      // Caminho fora da convenção `<prefixo>-<branch>`, como no fhir-brasil.
      const path = plainWorktree(repo, 'feat/catalogo-lacunas', 'fixture-catalogo-lacunas');

      await quiet(() =>
        teardown({ branch: 'feat/catalogo-lacunas', cfg: repo.cfg, repoRoot: repo.root }),
      );

      assert.ok(!existsSync(path), 'diretório do worktree removido');
      assert.deepEqual(worktreePaths(repo.root), [repo.root]);
      assert.deepEqual(localBranches(repo.root), ['main']);
      assert.deepEqual(readRegistry(repo), {});
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });

  it('com --keep-branch remove o worktree e preserva a branch', async () => {
    const repo = makeRepo();
    try {
      branch(repo.root, 'feat/manter');
      const path = plainWorktree(repo, 'feat/manter', 'outro-lugar');

      await quiet(() =>
        teardown({ branch: 'feat/manter', cfg: repo.cfg, keepBranch: true, repoRoot: repo.root }),
      );

      assert.ok(!existsSync(path), 'diretório do worktree removido');
      assert.deepEqual(worktreePaths(repo.root), [repo.root]);
      assert.deepEqual(localBranches(repo.root), ['feat/manter', 'main']);
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });

  it('o CLI sai com código 0 a partir do checkout principal', () => {
    const repo = makeRepo();
    try {
      branch(repo.root, 'feat/via-cli');
      const path = plainWorktree(repo, 'feat/via-cli', 'fixture-via-cli-manual');

      const res = cli(repo, 'teardown', 'feat/via-cli');

      assert.equal(res.status, 0, `stdout: ${res.stdout}\nstderr: ${res.stderr}`);
      assert.ok(!existsSync(path), 'diretório do worktree removido');
      assert.deepEqual(localBranches(repo.root), ['main']);
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });
});

describe('teardown de worktree com alterações não commitadas', () => {
  it('recusa sem registro, cita o caminho e não altera nada', async () => {
    const repo = makeRepo();
    try {
      branch(repo.root, 'feat/sujo');
      const path = plainWorktree(repo, 'feat/sujo', 'fixture-sujo-manual');
      writeFileSync(join(path, 'rascunho.txt'), 'trabalho em andamento\n');

      await assert.rejects(
        quiet(() => teardown({ branch: 'feat/sujo', cfg: repo.cfg, repoRoot: repo.root })),
        (err) => {
          assert.ok(err.message.includes(path), `mensagem cita o caminho: ${err.message}`);
          assert.match(err.message, /has uncommitted changes/);
          return true;
        },
      );

      assert.ok(existsSync(join(path, 'rascunho.txt')), 'arquivo preservado');
      assert.deepEqual(worktreePaths(repo.root), [repo.root, path]);
      assert.deepEqual(localBranches(repo.root), ['feat/sujo', 'main']);
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });

  it('recusa também o worktree registrado e mantém a entrada no registro', async () => {
    const entry = { ports: { api: 59961 }, slot: 1 };
    const repo = makeRepo({ 'feat/sujo-registrado': entry });
    try {
      branch(repo.root, 'feat/sujo-registrado');
      // Caminho da convenção, como o `setup` cria.
      const path = plainWorktree(repo, 'feat/sujo-registrado', 'fixture-feat-sujo-registrado');
      writeFileSync(join(path, 'package.json'), '{"modificado": true}\n');

      await assert.rejects(
        quiet(() =>
          teardown({ branch: 'feat/sujo-registrado', cfg: repo.cfg, repoRoot: repo.root }),
        ),
        (err) => err.message.includes(path),
      );

      assert.deepEqual(worktreePaths(repo.root), [repo.root, path]);
      assert.deepEqual(localBranches(repo.root), ['feat/sujo-registrado', 'main']);
      assert.deepEqual(readRegistry(repo), { 'feat/sujo-registrado': entry });
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });

  it('o CLI sai com código diferente de 0 e cita o caminho', () => {
    const repo = makeRepo();
    try {
      branch(repo.root, 'feat/sujo-cli');
      const path = plainWorktree(repo, 'feat/sujo-cli', 'fixture-sujo-cli-manual');
      writeFileSync(join(path, 'rascunho.txt'), 'trabalho em andamento\n');

      const res = cli(repo, 'teardown', 'feat/sujo-cli');

      assert.notEqual(res.status, 0);
      assert.ok(res.stderr.includes(path), `stderr cita o caminho: ${res.stderr}`);
      assert.match(res.stderr, /has uncommitted changes/);
      assert.ok(existsSync(join(path, 'rascunho.txt')), 'arquivo preservado');
      assert.deepEqual(localBranches(repo.root), ['feat/sujo-cli', 'main']);
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });
});

describe('teardown de entrada do registro sem worktree', () => {
  it('limpa a entrada quando o diretório sumiu mas o git ainda lista o worktree', async () => {
    const repo = makeRepo({ 'feat/sumiu': { ports: { api: 59961 }, slot: 1 } });
    const logPath = `/tmp/${repo.logPrefix}-feat-sumiu.log`;
    try {
      branch(repo.root, 'feat/sumiu');
      const path = plainWorktree(repo, 'feat/sumiu', 'fixture-feat-sumiu');
      rmSync(path, { force: true, recursive: true });
      writeFileSync(logPath, 'log\n');

      await quiet(() => teardown({ branch: 'feat/sumiu', cfg: repo.cfg, repoRoot: repo.root }));

      assert.deepEqual(worktreePaths(repo.root), [repo.root]);
      assert.deepEqual(localBranches(repo.root), ['main']);
      assert.deepEqual(readRegistry(repo), {});
      assert.ok(!existsSync(logPath), 'log removido');
    } finally {
      rmSync(logPath, { force: true });
      rmSync(repo.base, { force: true, recursive: true });
    }
  });

  it('limpa a entrada quando não há worktree nem branch', async () => {
    const repo = makeRepo({
      'feat/publicada': { ports: { api: 59961 }, slot: 1 },
      'feat/outra': { ports: { api: 59971 }, slot: 2 },
    });
    try {
      await quiet(() => teardown({ branch: 'feat/publicada', cfg: repo.cfg, repoRoot: repo.root }));

      assert.deepEqual(Object.keys(readRegistry(repo)), ['feat/outra']);
    } finally {
      rmSync(repo.base, { force: true, recursive: true });
    }
  });
});

describe('teardown de worktree registrado', () => {
  it('encerra o servidor, remove o worktree, libera a porta e apaga o log', async () => {
    // Servidor numa porta livre qualquer, no papel do `dev --detach`.
    const server = spawn(
      process.execPath,
      [
        '-e',
        "const s = require('net').createServer().listen(0, '127.0.0.1', () => console.log(s.address().port));",
      ],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const [chunk] = await once(server.stdout, 'data');
    const port = Number(String(chunk).trim());
    const repo = makeRepo({
      'feat/registrada': { ports: { api: port }, slot: 1 },
      'feat/vizinha': { ports: { api: 59971 }, slot: 2 },
    });
    const logPath = `/tmp/${repo.logPrefix}-feat-registrada.log`;
    try {
      branch(repo.root, 'feat/registrada');
      const path = plainWorktree(repo, 'feat/registrada', 'fixture-feat-registrada');
      writeFileSync(logPath, 'log\n');
      const exited = once(server, 'exit');

      await quiet(() =>
        teardown({ branch: 'feat/registrada', cfg: repo.cfg, repoRoot: repo.root }),
      );

      const [, signal] = await exited;
      assert.equal(signal, 'SIGTERM', 'servidor encerrado');
      assert.ok(!existsSync(path), 'diretório do worktree removido');
      assert.deepEqual(worktreePaths(repo.root), [repo.root]);
      assert.deepEqual(localBranches(repo.root), ['main']);
      assert.deepEqual(Object.keys(readRegistry(repo)), ['feat/vizinha']);
      assert.ok(!existsSync(logPath), 'log removido');
    } finally {
      server.kill('SIGKILL');
      rmSync(logPath, { force: true });
      rmSync(repo.base, { force: true, recursive: true });
    }
  });
});
