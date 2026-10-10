import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, it } from 'node:test';
import { parse } from 'yaml';
import { planConsumerUpdate, validateRelease } from '../../../scripts/prepare-consumers.mjs';
import { tokenContext } from '../dist/index.js';
import { MANIFEST } from './helpers.mjs';

const dir = mkdtempSync(join(tmpdir(), 'precisa-rollout-'));
after(() => rmSync(dir, { force: true, recursive: true }));
const ref = 'a'.repeat(40);
it('recusa versões antigas, tags móveis e entradas não numéricas', () => {
  for (const version of ['1.16.0', 'latest', '2.0.0; echo unsafe'])
    assert.throws(() => validateRelease(version, ref));
  assert.throws(() => validateRelease('2.0.0', 'main'));
});
it('prepara pins sem escrita nem perda de customizações e é idempotente', () => {
  const repo = join(dir, 'fixture');
  const workflows = join(repo, '.github/workflows');
  mkdirSync(workflows, { recursive: true });
  writeFileSync(join(repo, '.precisa.json'), JSON.stringify(MANIFEST));
  writeFileSync(
    join(workflows, 'ci.yml'),
    `on: pull_request\njobs:\n  release:\n    uses: Precisa-Saude/tooling/.github/workflows/_release.yml@${'b'.repeat(40)} # v1.16.0\n    with:\n      require_package_changes: false\n`,
  );
  writeFileSync(join(workflows, 'doctor.yml'), '# Requisitos do repositório\n');
  const options = { version: '2.0.0', ref, repositories: ['fixture'] };
  const changes = planConsumerUpdate(dir, options);
  assert.equal(changes.length, 2);
  assert.match(readFileSync(join(workflows, 'ci.yml'), 'utf8'), /v1.16.0/);
  for (const change of changes) {
    assert.doesNotThrow(() => parse(change.next));
    writeFileSync(change.path, change.next);
  }
  assert.match(readFileSync(join(workflows, 'ci.yml'), 'utf8'), /require_package_changes: false/);
  assert.match(readFileSync(join(workflows, 'doctor.yml'), 'utf8'), /CLI_VERSION: '2.0.0'/);
  assert.deepEqual(planConsumerUpdate(dir, options), []);
});
it('todos os templates preservam arquivos existentes e apontam para fontes disponíveis', () => {
  const root = fileURLToPath(new URL('../../..', import.meta.url));
  const templates = parse(
    readFileSync(resolve(root, 'templates/templates.manifest.yml'), 'utf8'),
  ).templates;
  const context = tokenContext(MANIFEST);
  assert.match(context.WORKFLOW_REF, /^[a-f0-9]{40}$/);
  assert.match(context.CLI_VERSION, /^\d+\.\d+\.\d+$/);
  for (const entry of templates) {
    assert.equal(entry.merge_strategy, 'skip_if_exists', entry.target);
    assert.doesNotThrow(() => readFileSync(resolve(root, 'templates', entry.source)));
  }
});
