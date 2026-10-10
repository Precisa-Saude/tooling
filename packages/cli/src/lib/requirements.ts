import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';

import { parse as parseYaml } from 'yaml';

import type { PrecisaManifest } from '../manifest.js';

export interface RequirementReport {
  message: string;
  severity: 'ok' | 'error';
  target: string;
}

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordValue)
    : {};

/** Verificação estrutural e offline; lint, build e testes continuam no CI. */
export function checkRequirements(cwd: string, manifest: PrecisaManifest): RequirementReport[] {
  const reports: RequirementReport[] = [];
  const report = (target: string, valid: boolean, message: string): void => {
    reports.push({ message, severity: valid ? 'ok' : 'error', target });
  };
  const json = (target: string): RecordValue => {
    try {
      const parsed: unknown = JSON.parse(readFileSync(resolve(cwd, target), 'utf8'));
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('esperado um objeto JSON');
      }
      return record(parsed);
    } catch (error) {
      report(target, false, (error as Error).message);
      return {};
    }
  };
  const pkg = json('package.json');
  const scripts = record(pkg.scripts);
  const requiredScripts = [
    ...new Set([
      'lint',
      'typecheck',
      'format:check',
      'test',
      ...(manifest.hasPackages ? ['build'] : []),
      ...(manifest.requiredScripts ?? []),
    ]),
  ];
  for (const name of requiredScripts) {
    report(
      `package.json#scripts.${name}`,
      typeof scripts[name] === 'string' && String(scripts[name]).trim().length > 0,
      `Comando obrigatório: ${name}`,
    );
  }
  report(
    'package.json#packageManager',
    /^pnpm@\d+\.\d+\.\d+(?:\+[^\s]+)?$/.test(String(pkg.packageManager)),
    'Declare a versão exata do pnpm em packageManager.',
  );
  const nodeMajor = Number((manifest.nodeVersion ?? '22').split('.')[0]);
  report(
    '.precisa.json#nodeVersion',
    nodeMajor >= 22 && Number(process.versions.node.split('.')[0]) >= nodeMajor,
    `Node suportado: >=${nodeMajor}; execução: ${process.versions.node}.`,
  );
  for (const target of ['pnpm-lock.yaml', 'eslint.config.js', '.prettierrc']) {
    report(target, existsSync(resolve(cwd, target)), 'Arquivo de configuração obrigatório.');
  }
  if (existsSync(resolve(cwd, '.prettierrc'))) {
    try {
      JSON.parse(readFileSync(resolve(cwd, '.prettierrc'), 'utf8'));
    } catch (error) {
      report('.prettierrc', false, (error as Error).message);
    }
  }
  for (const target of manifest.publishPackages ?? []) {
    const path = resolve(cwd, target);
    if (!path.startsWith(resolve(cwd) + sep)) {
      report(target, false, 'O pacote precisa estar dentro do repositório.');
      continue;
    }
    const published = json(`${target}/package.json`);
    report(
      target,
      typeof published.name === 'string' && published.private !== true,
      'Pacote declarado para publicação precisa ter nome e ser público.',
    );
  }

  const workflows = new Map<string, RecordValue>();
  const workflowSources = new Map<string, string>();
  const workflowDir = resolve(cwd, '.github/workflows');
  if (existsSync(workflowDir)) {
    for (const file of readdirSync(workflowDir).filter((name) => /\.ya?ml$/.test(name))) {
      const target = `.github/workflows/${file}`;
      try {
        const source = readFileSync(resolve(cwd, target), 'utf8');
        const workflow = record(parseYaml(source));
        if (!workflow.on || Object.keys(record(workflow.jobs)).length === 0) {
          throw new Error('Workflow precisa declarar on e jobs.');
        }
        workflows.set(target, workflow);
        workflowSources.set(target, source);
      } catch (error) {
        report(target, false, (error as Error).message);
      }
    }
  }

  const commands: string[] = [];
  const visited = new Set<string>();
  const sharedScripts = new Set<string>();
  const visit = (target: string, suppliedInputs: RecordValue = {}): void => {
    const visitKey = `${target}:${JSON.stringify(suppliedInputs)}`;
    if (visited.has(visitKey)) return;
    visited.add(visitKey);
    const workflow = workflows.get(target);
    if (!workflow) {
      report(target, false, 'Workflow local referenciado não existe ou é inválido.');
      return;
    }
    const inputDefinitions = record(record(record(workflow.on).workflow_call).inputs);
    const inputValue = (name: string): unknown =>
      suppliedInputs[name] ?? record(inputDefinitions[name]).default;
    for (const value of Object.values(record(workflow.jobs))) {
      const job = record(value);
      if (job.if === false || job['continue-on-error'] === true) continue;
      // Jobs exclusivamente de publicação não satisfazem checks de PR.
      if (
        typeof job.if === 'string' &&
        /github\.event_name\s*==\s*['"]push['"]/.test(job.if) &&
        !job.if.includes('pull_request')
      )
        continue;
      if (typeof job.uses === 'string') {
        if (job.uses.startsWith('./.github/workflows/')) visit(job.uses.slice(2), record(job.with));
        if (/^Precisa-Saude\/tooling\/\.github\/workflows\//i.test(job.uses)) {
          const escapedUse = job.uses.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const versionComment = new RegExp(
            `uses: ?["']?${escapedUse}["']? +# v\\d+\\.\\d+\\.\\d+\\b`,
          );
          report(
            target,
            /@[a-f0-9]{40}$/.test(job.uses) &&
              versionComment.test(workflowSources.get(target) ?? ''),
            'Workflow compartilhado deve usar SHA completo e comentário de versão.',
          );
          if (/\/_checks\.yml@[a-f0-9]{40}$/.test(job.uses)) {
            for (const name of ['lint', 'typecheck', 'format:check', 'build', 'test'])
              sharedScripts.add(name);
            const testScript = record(job.with).test_script;
            if (typeof testScript === 'string') sharedScripts.add(testScript);
          }
        }
      }
      for (const stepValue of Array.isArray(job.steps) ? job.steps : []) {
        const step = record(stepValue);
        if (
          typeof step.run === 'string' &&
          step.if !== false &&
          step['continue-on-error'] !== true
        ) {
          const env = { ...record(workflow.env), ...record(job.env), ...record(step.env) };
          const command = step.run.replace(/\$([A-Z_][A-Z_0-9]*)/g, (match, name: string) => {
            const value = env[name];
            const input =
              typeof value === 'string' ? /^\$\{\{ inputs\.([\w_]+) \}\}$/.exec(value) : null;
            const resolved = input ? inputValue(input[1]!) : value;
            return typeof resolved === 'string' ? resolved : match;
          });
          commands.push(command);
        }
      }
    }
  };
  const roots = [...workflows].filter(([, workflow]) => {
    const on = workflow.on;
    return (
      on === 'pull_request' ||
      (Array.isArray(on) && on.includes('pull_request')) ||
      Object.hasOwn(record(on), 'pull_request')
    );
  });
  report('.github/workflows', roots.length > 0, 'CI precisa executar em pull_request.');
  for (const [target] of roots) visit(target);
  for (const script of requiredScripts) {
    const escaped = script.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const invocation = new RegExp(
      `(?:^|[;&|])\\s*pnpm\\s+(?:(?:--filter|-F)\\s+\\S+\\s+)?(?:run\\s+|(?:exec\\s+)?turbo\\s+run\\s+)?["']?${escaped}["']?(?=\\s|$)`,
      'm',
    );
    const wired =
      sharedScripts.has(script) ||
      commands.some((command) => invocation.test(command.replace(/^\s*#.*$/gm, '')));
    report(`CI#${script}`, wired, `O CI de PR precisa chamar ${script}.`);
  }
  return reports;
}
