import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fixture, MANIFEST, run, write } from './helpers.mjs';

const dirs = [];
const repo = (manifest) => {
  const dir = fixture(manifest);
  dirs.push(dir);
  return dir;
};
after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe('doctor verifica requisitos', () => {
  it('distingue manifesto ausente e inválido de requisitos pendentes', () => {
    assert.equal(run(['doctor'], repo(null)).status, 2);
    assert.equal(run(['doctor'], repo({ ...MANIFEST, hasSite: true })).status, 2);
    for (const value of [
      [],
      42,
      { ...MANIFEST, requiredScripts: [''] },
      { ...MANIFEST, nodeVersion: 22 },
    ]) {
      const dir = repo();
      write(dir, '.precisa.json', value);
      assert.equal(run(['doctor'], dir).status, 2);
    }
  });
  it('aceita customizações e documentação local sem comparar templates', () => {
    const dir = repo();
    write(dir, '.editorconfig', '# configuração própria');
    write(dir, 'SECURITY.md', 'Contato específico do produto.');
    assert.equal(run(['doctor'], dir).status, 0);
  });
  it('aponta um comando ausente e um comando que não chega ao CI', () => {
    const dir = repo();
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json')));
    delete pkg.scripts.test;
    write(dir, 'package.json', pkg);
    let result = run(['doctor'], dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /scripts.test/);
    pkg.scripts.test = 'node --test';
    write(dir, 'package.json', pkg);
    const ci = readFileSync(join(dir, '.github/workflows/ci.yml'), 'utf8');
    write(dir, '.github/workflows/ci.yml', ci.replace('- run: pnpm test', '# pnpm test'));
    result = run(['doctor'], dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /CI#test/);
  });
  it('detecta YAML inválido e referências locais quebradas', () => {
    const dir = repo();
    write(dir, '.github/workflows/ci.yml', 'on: [pull_request\n');
    assert.equal(run(['doctor'], dir).status, 1);
    write(
      dir,
      '.github/workflows/ci.yml',
      'on: pull_request\njobs:\n  checks:\n    uses: ./.github/workflows/missing.yml\n',
    );
    const result = run(['doctor'], dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /referenciado/);
  });
  it('segue workflows locais, resolve inputs e termina em ciclos', () => {
    const dir = repo();
    const ci = readFileSync(join(dir, '.github/workflows/ci.yml'), 'utf8');
    write(
      dir,
      '.github/workflows/checks.yml',
      ci.replace('on: [pull_request, push]', 'on: workflow_call'),
    );
    write(
      dir,
      '.github/workflows/ci.yml',
      'on: pull_request\njobs:\n  checks:\n    uses: ./.github/workflows/checks.yml\n',
    );
    assert.equal(run(['doctor'], dir).status, 0);
    write(
      dir,
      '.github/workflows/checks.yml',
      'on: workflow_call\njobs:\n  cycle:\n    uses: ./.github/workflows/ci.yml\n',
    );
    assert.equal(run(['doctor'], dir).status, 1);
  });
  it('exige referência imutável para checks compartilhados', () => {
    const dir = repo();
    const workflow =
      'on: pull_request\njobs:\n  checks:\n    uses: Precisa-Saude/tooling/.github/workflows/_checks.yml@';
    write(dir, '.github/workflows/ci.yml', workflow + 'main\n');
    assert.equal(run(['doctor'], dir).status, 1);
    write(
      dir,
      '.github/workflows/ci.yml',
      workflow + '1d231f69c570aea4b70b3018a32da9ff9dd2ec1c # v1.16.0\n',
    );
    assert.equal(run(['doctor'], dir).status, 0);
  });
  it('verifica cobertura quando o repo a declara como requisito', () => {
    const dir = repo({ ...MANIFEST, requiredScripts: ['test:coverage'] });
    const result = run(['doctor'], dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /CI#test:coverage/);
  });
  it('reconhece testes e cobertura adicionais no workflow local e detecta a retirada do gate', () => {
    const dir = repo({ ...MANIFEST, requiredScripts: ['test:coverage'] });
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json')));
    pkg.scripts['test:coverage'] = 'node --test --experimental-test-coverage';
    write(dir, 'package.json', pkg);
    write(
      dir,
      '.github/workflows/_checks.yml',
      readFileSync(new URL('../../../.github/workflows/_checks.yml', import.meta.url), 'utf8'),
    );
    const ci = `on: pull_request
jobs:
  checks:
    uses: ./.github/workflows/_checks.yml
    with:
      test_script: test:coverage
`;
    write(dir, '.github/workflows/ci.yml', ci);
    assert.equal(run(['doctor'], dir).status, 0);
    write(
      dir,
      '.github/workflows/ci.yml',
      ci.replace('test_script: test:coverage', 'test_script: test'),
    );
    const result = run(['doctor'], dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /CI#test:coverage/);
  });
  it('recusa publicar pacote privado ou fora do repositório', () => {
    for (const path of ['packages/private', '../outside']) {
      const dir = repo({ ...MANIFEST, publishesToNpm: true, publishPackages: [path] });
      write(dir, 'packages/private/package.json', { name: '@fixture/private', private: true });
      assert.equal(run(['doctor'], dir).status, 1);
    }
  });
  it('recusa configuração JSON inválida e pnpm sem versão exata', () => {
    const dir = repo();
    write(dir, '.prettierrc', '{');
    assert.equal(run(['doctor'], dir).status, 1);
    write(dir, '.prettierrc', '{}');
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json')));
    pkg.packageManager = 'pnpm@latest';
    write(dir, 'package.json', pkg);
    assert.equal(run(['doctor'], dir).status, 1);
  });
});

it('menções em echo e jobs que ignoram falhas não satisfazem um requisito', () => {
  const dir = repo();
  const ci = readFileSync(join(dir, '.github/workflows/ci.yml'), 'utf8');
  write(dir, '.github/workflows/ci.yml', ci.replace('run: pnpm test', 'run: echo pnpm test'));
  assert.equal(run(['doctor'], dir).status, 1);
  write(
    dir,
    '.github/workflows/ci.yml',
    ci.replace('  checks:', '  checks:\n    continue-on-error: true'),
  );
  assert.equal(run(['doctor'], dir).status, 1);
});
it('um workflow compartilhado precisa do comentário de versão para receber updates', () => {
  const dir = repo();
  write(
    dir,
    '.github/workflows/ci.yml',
    'on: pull_request\njobs:\n  checks:\n    uses: Precisa-Saude/tooling/.github/workflows/_checks.yml@1d231f69c570aea4b70b3018a32da9ff9dd2ec1c\n',
  );
  assert.equal(run(['doctor'], dir).status, 1);
});
