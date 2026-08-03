import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * `ignoreTemplates` existe porque 39 dos 44 templates são `overwrite` e não
 * havia como declarar customização deliberada: ela virava drift permanente,
 * reportado todo mês, e um `sync` a descartava sem backup. Estes testes fixam
 * as duas garantias que tornam a declaração confiável — o sync não escreve e
 * o doctor não acusa.
 */

const BIN = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'bin.js');
const ALVO = '.editorconfig';
const temp = [];

const MANIFESTO = {
  schemaVersion: 1,
  name: 'fixture',
  owner: 'Precisa-Saude',
  visibility: 'oss',
  hasSite: false,
  hasPackages: false,
  publishesToNpm: false,
  commitScopes: ['ci'],
  contactEmails: { security: 's@example.com', conduct: 'c@example.com' },
};

function repo(manifest) {
  const dir = mkdtempSync(join(tmpdir(), 'precisa-ignore-'));
  temp.push(dir);
  writeFileSync(join(dir, '.precisa.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return dir;
}

const roda = (args, cwd) =>
  spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
    maxBuffer: 16 * 1024 * 1024,
  });

after(() => temp.forEach((d) => rmSync(d, { force: true, recursive: true })));

describe('ignoreTemplates', () => {
  it('sync não sobrescreve alvo declarado', () => {
    const dir = repo(MANIFESTO);
    assert.equal(roda(['sync'], dir).status, 0);

    const meu = '# fork deliberado deste repo\n';
    writeFileSync(join(dir, ALVO), meu);

    // Sem declarar: o sync reescreve (comportamento atual, destrutivo).
    assert.equal(roda(['sync'], dir).status, 0);
    assert.notEqual(readFileSync(join(dir, ALVO), 'utf8'), meu);

    // Declarando: o conteúdo local sobrevive.
    writeFileSync(join(dir, ALVO), meu);
    writeFileSync(
      join(dir, '.precisa.json'),
      `${JSON.stringify({ ...MANIFESTO, ignoreTemplates: [ALVO] }, null, 2)}\n`,
    );
    assert.equal(roda(['sync'], dir).status, 0);
    assert.equal(readFileSync(join(dir, ALVO), 'utf8'), meu);
  });

  it('doctor não conta alvo declarado como drift', () => {
    const dir = repo(MANIFESTO);
    assert.equal(roda(['sync'], dir).status, 0);
    writeFileSync(join(dir, ALVO), '# fork deliberado\n');

    // Sem declarar: drift → exit 1.
    assert.equal(roda(['doctor'], dir).status, 1);

    // Declarando: limpo → exit 0.
    writeFileSync(
      join(dir, '.precisa.json'),
      `${JSON.stringify({ ...MANIFESTO, ignoreTemplates: [ALVO] }, null, 2)}\n`,
    );
    const { status, stdout } = roda(['doctor'], dir);
    assert.equal(status, 0, stdout);
    assert.match(stdout, /Divergência deliberada/);
  });

  it('rejeita entradas vazias ou de tipo errado', () => {
    for (const ruim of ['nao-lista', [''], ['  '], [42]]) {
      const dir = repo({ ...MANIFESTO, ignoreTemplates: ruim });
      assert.equal(roda(['doctor'], dir).status, 2, `deveria rejeitar ${JSON.stringify(ruim)}`);
    }
  });
});
