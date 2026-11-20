/**
 * Apoio dos testes que rodam o `dist/bin.js` num processo filho: o caminho do
 * binário, o ambiente sem coleta de cobertura e um `gh` falso que responde com
 * uma lista fixa de PRs, para o `prune` rodar sem rede nem GitHub.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BIN = join(PACKAGE_DIR, 'dist', 'bin.js');

/**
 * Sem `NODE_V8_COVERAGE`: com `--experimental-test-coverage` o bundle somaria
 * ao relatório arquivos que só ele carrega (ver teardown.integration.test.mjs).
 */
const baseEnv = { ...process.env, NODE_V8_COVERAGE: undefined };

/**
 * Instala em `<base>/bin/gh` um `gh` que responde `repo view` e `pr list` com
 * `prs`. Devolve o ambiente com esse diretório na frente do PATH.
 */
export function fakeGh(base, prs = []) {
  const bin = join(base, 'bin');
  mkdirSync(bin, { recursive: true });
  const prsFile = join(base, 'prs.json');
  writeFileSync(prsFile, JSON.stringify(prs));
  const script = [
    '#!/bin/sh',
    'case "$1 $2" in',
    `  "repo view") echo '{"nameWithOwner":"fixture/repo","defaultBranchRef":{"name":"main"}}' ;;`,
    `  "pr list") cat '${prsFile}' ;;`,
    '  *) echo "fake gh: unexpected $*" >&2; exit 1 ;;',
    'esac',
    '',
  ].join('\n');
  writeFileSync(join(bin, 'gh'), script);
  chmodSync(join(bin, 'gh'), 0o755);
  return { ...baseEnv, PATH: `${bin}:${process.env.PATH}` };
}

/** Executa o binário com `cwd`; `env` padrão sem cobertura. */
export function cli(cwd, args, env = baseEnv) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf-8', env });
}
