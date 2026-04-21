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
];
