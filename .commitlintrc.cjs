const base = require('@precisa-saude/commitlint-config');

/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  ...base,
  rules: {
    ...base.rules,
    'scope-enum': [
      2,
      'always',
      [
        'eslint',
        'prettier',
        'tsconfig',
        'commitlint',
        'themes',
        'ui',
        'cli',
        'templates',
        'docs',
        'ci',
        'deps',
        'lint',
        'release',
      ],
    ],
  },
};
