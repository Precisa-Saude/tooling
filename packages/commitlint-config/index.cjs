/**
 * @precisa-saude/commitlint-config
 *
 * Shared commitlint config. Scopes are parameterized per repo via the
 * PRECISA_COMMIT_SCOPES env var (comma-separated) or by overriding the
 * `scope-enum` rule in the consuming repo's `.commitlintrc.cjs`.
 *
 * Usage (simple — uses default scopes):
 *   // .commitlintrc.cjs
 *   module.exports = require('@precisa-saude/commitlint-config');
 *
 * Usage (per-repo scopes via env):
 *   PRECISA_COMMIT_SCOPES="core,calculators,ocr-utils,rnds,docs,ci,deps"
 *   // .commitlintrc.cjs
 *   module.exports = require('@precisa-saude/commitlint-config');
 *
 * Usage (per-repo scopes via override):
 *   // .commitlintrc.cjs
 *   const base = require('@precisa-saude/commitlint-config');
 *   module.exports = {
 *     ...base,
 *     rules: {
 *       ...base.rules,
 *       'scope-enum': [2, 'always', ['api', 'web', 'landing', 'ui', 'deps']],
 *     },
 *   };
 */

const DEFAULT_SCOPES = ['docs', 'ci', 'deps', 'lint', 'config', 'release'];

const envScopes = (process.env.PRECISA_COMMIT_SCOPES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const scopes = envScopes.length > 0 ? envScopes : DEFAULT_SCOPES;

/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'chore',
        'revert',
        'build',
        'ci',
      ],
    ],
    'scope-enum': [2, 'always', scopes],
    'subject-case': [0],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-max-length': [2, 'always', 100],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'body-leading-blank': [1, 'always'],
    'body-max-line-length': [2, 'always', 100],
    'footer-leading-blank': [1, 'always'],
  },
};
