import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
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

describe('scaffold preserva a propriedade local', () => {
  it('sync antigo falha com orientação e não altera arquivos', () => {
    const dir = repo();
    write(dir, 'SECURITY.md', 'Contato local');
    const result = run(['sync'], dir);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /descontinuado/);
    assert.equal(readFileSync(join(dir, 'SECURITY.md'), 'utf8'), 'Contato local');
    assert.equal(existsSync(join(dir, '.editorconfig')), false);
  });
  it('adiciona apenas arquivos selecionados e nunca sobrescreve', () => {
    const dir = repo();
    assert.equal(run(['scaffold', '--only', '.editorconfig', '--dry-run'], dir).status, 0);
    assert.equal(existsSync(join(dir, '.editorconfig')), false);
    assert.equal(run(['scaffold', '--only', '.editorconfig'], dir).status, 0);
    assert.equal(existsSync(join(dir, 'SECURITY.md')), false);
    write(dir, '.editorconfig', '# customização local');
    assert.equal(run(['scaffold', '--only', '.editorconfig'], dir).status, 0);
    assert.equal(readFileSync(join(dir, '.editorconfig'), 'utf8'), '# customização local');
  });
  it('valida toda a seleção antes de escrever', () => {
    const dir = repo();
    assert.equal(run(['scaffold', '--only', '.editorconfig', '../escape'], dir).status, 1);
    assert.equal(existsSync(join(dir, '.editorconfig')), false);
    assert.notEqual(run(['scaffold'], dir).status, 0);
  });
  it('mantém ignoreTemplates compatível sem esconder requisitos', () => {
    const dir = repo({
      ...MANIFEST,
      ignoreTemplates: ['.editorconfig', '.github/workflows/ci.yml'],
    });
    assert.equal(run(['scaffold', '--only', '.editorconfig'], dir).status, 1);
    rmSync(join(dir, '.github/workflows/ci.yml'));
    assert.equal(run(['doctor'], dir).status, 1);
  });
  it('rejeita ignoreTemplates malformado', () => {
    for (const value of ['invalid', [''], ['  '], [42]]) {
      assert.equal(run(['doctor'], repo({ ...MANIFEST, ignoreTemplates: value })).status, 2);
    }
  });
});

it('o template de commitlint produz JavaScript válido', () => {
  const dir = repo();
  assert.equal(run(['scaffold', '--only', '.commitlintrc.cjs'], dir).status, 0);
  const result = spawnSync(process.execPath, ['--check', join(dir, '.commitlintrc.cjs')], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
});
