import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { tokenContext, validateManifest } from '../dist/index.js';

/**
 * `siteSourcePath` passou a aceitar lista porque prefixo único não descrevia
 * a realidade: no medbench-brasil o leaderboard é montado a partir de
 * `results/` (via `import.meta.glob`), então uma PR que só adiciona modelos
 * muda o site sem tocar em `site/`. Com um prefixo só, o deploy era pulado em
 * silêncio enquanto o CI reportava verde.
 *
 * O token vai para o workflow como string separada por vírgula; o split é lá.
 */

const BASE = {
  schemaVersion: 1,
  name: 'fixture',
  owner: 'Precisa-Saude',
  visibility: 'oss',
  hasSite: true,
  hasPackages: false,
  publishesToNpm: false,
  siteFilter: '@fixture/site',
  siteProjectName: 'fixture',
  commitScopes: ['ci'],
  contactEmails: { security: 's@example.com', conduct: 'c@example.com' },
};

describe('siteSourcePath', () => {
  it('usa site/ por padrão quando omitido', () => {
    assert.equal(tokenContext(BASE).SITE_SOURCE_PATH, 'site/');
  });

  it('aceita string única (forma antiga segue válida)', () => {
    const ctx = tokenContext({ ...BASE, siteSourcePath: 'packages/site/' });
    assert.equal(ctx.SITE_SOURCE_PATH, 'packages/site/');
  });

  it('serializa lista como string separada por vírgula', () => {
    const ctx = tokenContext({ ...BASE, siteSourcePath: ['site/', 'results/'] });
    assert.equal(ctx.SITE_SOURCE_PATH, 'site/,results/');
  });

  it('descarta entradas vazias e espaços', () => {
    const ctx = tokenContext({ ...BASE, siteSourcePath: [' site/ ', '', 'results/'] });
    assert.equal(ctx.SITE_SOURCE_PATH, 'site/,results/');
  });

  it('valida string e lista não-vazia', () => {
    assert.deepEqual(validateManifest({ ...BASE, siteSourcePath: 'site/' }), []);
    assert.deepEqual(validateManifest({ ...BASE, siteSourcePath: ['site/', 'results/'] }), []);
  });

  it('rejeita lista vazia e tipos errados', () => {
    for (const ruim of [[], [123], '', 42, {}]) {
      const errs = validateManifest({ ...BASE, siteSourcePath: ruim });
      assert.ok(
        errs.some((e) => e.path === 'siteSourcePath'),
        `deveria rejeitar ${JSON.stringify(ruim)}`,
      );
    }
  });

  // O predicado do workflow é `prefixes.some(p => f.startsWith(p))`. Este teste
  // reproduz a lógica contra os conjuntos de arquivos reais das PRs #47 e #48
  // do medbench, para fixar o comportamento que motivou a mudança.
  it('o predicado do workflow pega PR que só mexe em results/', () => {
    const prefixes = tokenContext({ ...BASE, siteSourcePath: ['site/', 'results/'] })
      .SITE_SOURCE_PATH.split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const mudou = (arquivos) => arquivos.some((f) => prefixes.some((p) => f.startsWith(p)));

    assert.equal(mudou(['results/enamed-2025/gpt-5.6-sol.json', 'docs/PLAN.md']), true);
    assert.equal(mudou(['site/src/data/models.ts']), true);
    assert.equal(mudou(['.github/workflows/ci.yml']), false);
    assert.equal(mudou(['README.md']), false);
  });
});
