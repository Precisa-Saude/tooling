import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Os exit codes do `doctor` são contrato com o workflow `doctor.yml`, que
 * reporta cada um de um jeito diferente (drift → issue; manifesto inválido →
 * erro de anotação; outro → falha barulhenta).
 *
 * Colapsá-los foi o bug que fez a auditoria mensal virar ruído: com o CLI
 * ausente nos repos consumidores, `pnpm exec precisa doctor` saía não-zero por
 * "command not found" e abria uma issue de "drift" por mês, em todo repo, sem
 * nunca ter comparado um template. Estes testes fixam a separação.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = resolve(HERE, '..', 'dist', 'bin.js');

const MANIFEST_VALIDO = {
  schemaVersion: 1,
  name: 'fixture-repo',
  owner: 'Precisa-Saude',
  visibility: 'oss',
  hasSite: false,
  hasPackages: false,
  publishesToNpm: false,
  commitScopes: ['ci', 'docs'],
  contactEmails: {
    security: 'security@example.com',
    conduct: 'conduct@example.com',
  },
};

const temporarios = [];

function repoTemporario(manifest) {
  const dir = mkdtempSync(join(tmpdir(), 'precisa-doctor-'));
  temporarios.push(dir);
  if (manifest !== undefined) {
    writeFileSync(join(dir, '.precisa.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  return dir;
}

function roda(comando, cwd) {
  const r = spawnSync(process.execPath, [BIN, ...comando], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
    // O padrão do Node é 1 MiB. Estourar não lança: o spawn volta com
    // `status: null` e saída truncada, o que faria as asserções de exit code
    // falharem por um motivo que não tem nada a ver com o que está sendo
    // testado. Teto folgado + checagem explícita abaixo.
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(r.error, undefined, `spawn falhou: ${r.error?.message}`);
  assert.notEqual(r.status, null, 'processo morreu por sinal ou estouro de buffer');
  return r;
}

after(() => {
  for (const dir of temporarios) rmSync(dir, { force: true, recursive: true });
});

describe('precisa doctor — exit codes', () => {
  it('sai 2 quando não existe .precisa.json', () => {
    const { status, stderr } = roda(['doctor'], repoTemporario(undefined));
    assert.equal(status, 2, 'manifesto ausente não pode ser reportado como drift');
    assert.match(stderr, /precisa\.json/);
  });

  it('sai 2 quando o .precisa.json é inválido', () => {
    // `hasSite: true` exige siteFilter e siteProjectName — é exatamente o
    // estado em que medbench-brasil e fhir-brasil estavam quando o audit
    // reportava "drift".
    const dir = repoTemporario({ ...MANIFEST_VALIDO, hasSite: true });
    const { status, stderr } = roda(['doctor'], dir);
    assert.equal(status, 2, 'manifesto inválido não é drift — sync não resolve');
    assert.match(stderr, /Invalid \.precisa\.json/);
  });

  it('sai 1 quando faltam arquivos exigidos pelo perfil', () => {
    const { status } = roda(['doctor'], repoTemporario(MANIFEST_VALIDO));
    assert.equal(status, 1);
  });

  it('sai 0 depois de um sync — round-trip sync→doctor é limpo', () => {
    const dir = repoTemporario(MANIFEST_VALIDO);
    const sync = roda(['sync'], dir);
    assert.equal(sync.status, 0, `sync falhou: ${sync.stderr}`);

    const { status, stdout } = roda(['doctor'], dir);
    assert.equal(status, 0, `doctor deveria estar limpo após sync:\n${stdout}`);
  });

  it('sai 1 quando um arquivo `overwrite` é editado após o sync', () => {
    const dir = repoTemporario(MANIFEST_VALIDO);
    assert.equal(roda(['sync'], dir).status, 0);

    // `.editorconfig` é `overwrite` no templates.manifest.yml: editá-lo é
    // exatamente o drift que o sync reescreveria.
    const alvo = join(dir, '.editorconfig');
    writeFileSync(alvo, `${readFileSync(alvo, 'utf8')}\n# deriva local\n`);

    const { status, stdout } = roda(['doctor'], dir);
    assert.equal(status, 1, 'drift de conteúdo precisa sair não-zero');
    assert.match(stdout, /editorconfig/);
  });
});
