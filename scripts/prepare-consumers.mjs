#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const toolingRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const consumers = [
  'platform',
  'decks',
  'fhir-brasil',
  'calculadoras-clinicas',
  'medbench-brasil',
  'datasus-dbc',
  'datasus-sdk',
  'datasus-parquet',
  'datasus-viz',
  'pns',
];

export function validateRelease(version, ref) {
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '') || Number(version.split('.')[0]) < 2) {
    throw new Error('Informe a versão estável publicada do CLI com o novo contrato (>=2.0.0).');
  }
  if (!/^[a-f0-9]{40}$/.test(ref ?? '')) throw new Error('Informe o SHA completo da release.');
}

export function planConsumerUpdate(root, { version, ref, repositories = consumers }) {
  validateRelease(version, ref);
  const changes = [];
  const doctorTemplate = readFileSync(
    resolve(toolingRoot, 'templates/github/workflows/doctor.yml'),
    'utf8',
  );
  for (const name of repositories) {
    const dir = resolve(root, name);
    const manifest = JSON.parse(readFileSync(resolve(dir, '.precisa.json'), 'utf8'));
    const workflows = resolve(dir, '.github/workflows');
    for (const file of readdirSync(workflows).filter((name) => /\.ya?ml$/.test(name))) {
      const path = resolve(workflows, file);
      const previous = readFileSync(path, 'utf8');
      let next = previous.replace(
        /Precisa-Saude\/tooling\/\.github\/workflows\/([\w.-]+)@[a-f0-9]{40}(?:[ \t]+# v[\d.]+)?/g,
        `Precisa-Saude/tooling/.github/workflows/$1@${ref} # v${version}`,
      );
      if (file === 'doctor.yml') {
        if (!previous.includes('Requisitos do repositório')) {
          throw new Error(`${name}: migre o workflow de requisitos antes de atualizar os pins.`);
        }
        next = doctorTemplate
          .replaceAll('{{CLI_VERSION}}', version)
          .replaceAll('{{NODE_VERSION}}', manifest.nodeVersion ?? '22');
      }
      if (next !== previous) changes.push({ path, previous, next });
    }
    if (!existsSync(resolve(workflows, 'doctor.yml')))
      throw new Error(`${name}: doctor.yml ausente.`);
  }
  return changes;
}

async function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string' },
      version: { type: 'string' },
      ref: { type: 'string' },
      write: { type: 'boolean', default: false },
    },
  });
  if (!values.root) throw new Error('Use --root <diretório dos worktrees consumidores>.');
  validateRelease(values.version, values.ref);
  // A conferência acontece antes de qualquer escrita, inclusive no modo de simulação.
  const publishedRef = execFileSync(
    'gh',
    ['api', `repos/Precisa-Saude/tooling/commits/v${values.version}`, '--jq', '.sha'],
    { encoding: 'utf8' },
  ).trim();
  if (publishedRef !== values.ref)
    throw new Error('O SHA informado não corresponde à tag publicada.');
  const publishedVersion = execFileSync(
    'npm',
    [
      'view',
      `@precisa-saude/cli@${values.version}`,
      'version',
      '--registry=https://registry.npmjs.org',
    ],
    { encoding: 'utf8' },
  ).trim();
  if (publishedVersion !== values.version)
    throw new Error('A versão ainda não está publicada no npm.');
  const changes = planConsumerUpdate(resolve(values.root), {
    version: values.version,
    ref: values.ref,
  });
  for (const change of changes) {
    if (values.write) writeFileSync(change.path, change.next);
    console.log(`${values.write ? 'Atualizado' : 'Planejado'}: ${change.path}`);
  }
  console.log(`${changes.length} arquivo(s). Revise o diff e execute o CI antes de mesclar.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
