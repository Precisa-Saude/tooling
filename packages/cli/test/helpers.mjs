import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BIN = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/bin.js');
export const MANIFEST = {
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
export function write(dir, file, content) {
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), typeof content === 'string' ? content : JSON.stringify(content));
}
export function fixture(manifest = MANIFEST) {
  const dir = mkdtempSync(join(tmpdir(), 'precisa-requirements-'));
  if (manifest) write(dir, '.precisa.json', manifest);
  write(dir, 'package.json', {
    packageManager: 'pnpm@9.15.9',
    scripts: {
      lint: 'eslint .',
      typecheck: 'tsc --noEmit',
      'format:check': 'prettier --check .',
      test: 'node --test',
    },
  });
  write(dir, 'pnpm-lock.yaml', 'lockfileVersion: 9\n');
  write(dir, 'eslint.config.js', 'export default [];\n');
  write(dir, '.prettierrc', '"@precisa-saude/prettier-config"');
  write(
    dir,
    '.github/workflows/ci.yml',
    `on: [pull_request, push]
jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm format:check
      - run: pnpm test
`,
  );
  return dir;
}
export function run(args, cwd) {
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return result;
}
