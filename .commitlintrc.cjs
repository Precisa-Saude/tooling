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
        'agent-instructions',
        'cli',
        'commitlint',
        'eslint',
        'prettier',
        'themes',
        'tsconfig',
        'ui',
        'worktree-cli',
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
