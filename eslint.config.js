import base from '@precisa-saude/eslint-config/base';

export default [
  ...base,
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.turbo/**',
      'packages/eslint-config/base.js',
      'packages/eslint-config/react.js',
    ],
  },
  {
    // CLI source: console output is the primary interface.
    files: ['packages/cli/src/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];
