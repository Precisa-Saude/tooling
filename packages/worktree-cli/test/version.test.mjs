/**
 * `precisa-worktree --version` informa a versão do `package.json` do pacote,
 * que o semantic-release atualiza a cada release, e não um número fixo no código.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { cli, PACKAGE_DIR } from './cli-fixtures.mjs';

const { version } = JSON.parse(readFileSync(join(PACKAGE_DIR, 'package.json'), 'utf-8'));

describe('precisa-worktree --version', () => {
  it('imprime a versão do package.json, de qualquer diretório', () => {
    assert.match(version, /^\d+\.\d+\.\d+/);
    // Fora de um repositório git e longe do pacote: a leitura não depende do cwd.
    for (const flag of ['--version', '-V']) {
      const res = cli(tmpdir(), [flag]);
      assert.equal(res.status, 0, res.stderr);
      assert.equal(res.stdout.trim(), version);
    }
  });
});
