import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { it } from 'node:test';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const workflow = parse(readFileSync(join(root, '.github/workflows/_checks.yml'), 'utf8'));
const steps = workflow.jobs.test.steps;
const testSteps = steps.slice(steps.findIndex((step) => step.run === 'pnpm build') + 1);

function runChecks(script = workflow.on.workflow_call.inputs.test_script.default, failScript = '') {
  const dir = mkdtempSync(join(tmpdir(), 'tooling-checks-'));
  const log = join(dir, 'commands.jsonl');
  const pnpm = join(dir, 'pnpm');
  writeFileSync(
    pnpm,
    `#!/usr/bin/env node
const { appendFileSync } = require('node:fs');
const args = process.argv.slice(2);
const script = args[0] === 'run' ? args[1] : args[0];
appendFileSync(process.env.CHECK_LOG, JSON.stringify(script) + '\\n');
process.exit(script === process.env.FAIL_SCRIPT ? 1 : 0);
`,
  );
  chmodSync(pnpm, 0o755);
  let status = 0;
  try {
    for (const step of testSteps) {
      if (step.if && !vm.runInNewContext(step.if, { inputs: { test_script: script } })) continue;
      const env = { ...process.env, CHECK_LOG: log, FAIL_SCRIPT: failScript };
      env.PATH = `${dir}:${env.PATH}`;
      for (const [key, value] of Object.entries(step.env ?? {})) {
        env[key] = value.replace(/\$\{\{ inputs\.test_script \}\}/g, script);
      }
      const result = spawnSync('sh', ['-e', '-c', step.run], { env, encoding: 'utf8' });
      if (result.error) throw result.error;
      status = result.status;
      if (status !== 0) break;
    }
    return { status, commands: readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

it('o default executa os testes normais uma única vez', () => {
  assert.deepEqual(runChecks(), { status: 0, commands: ['test'] });
});

it('coverage e outros scripts adicionais preservam os testes normais', () => {
  for (const script of ['test:coverage', 'test:integration']) {
    assert.deepEqual(runChecks(script), { status: 0, commands: ['test', script] });
  }
});

it('falha nos testes normais impede a etapa adicional e reprova o job', () => {
  assert.deepEqual(runChecks('test:coverage', 'test'), { status: 1, commands: ['test'] });
});

it('falha no script de cobertura também reprova o job', () => {
  assert.deepEqual(runChecks('test:coverage', 'test:coverage'), {
    status: 1,
    commands: ['test', 'test:coverage'],
  });
});

it('o CI local não agenda revisão externa enquanto a política da base ainda permite', () => {
  const ci = parse(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8'));
  const policy = JSON.parse(readFileSync(join(root, '.github/review-policy.json'), 'utf8'));
  assert.equal(policy.enabled, false);
  assert.equal(
    Object.values(ci.jobs).some((job) => /\/review\.yml/.test(job.uses ?? '')),
    false,
  );
});
