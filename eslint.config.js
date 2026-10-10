import base from '@precisa-saude/eslint-config/base';

export default [
  ...base,
  // Templates contêm tokens; sua sintaxe é validada após renderização nos testes do CLI.
  { ignores: ['**/.brand-check/**', 'templates/**'] },
  {
    // O CLI usa stdout/stderr como interface com o usuário e com o CI.
    files: ['packages/cli/src/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // Test files are excluded from package tsconfigs (to keep tsc --noEmit
    // tight), so disable type-aware parsing for them or ESLint errors
    // trying to locate a project.
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', '**/__tests__/**'],
    languageOptions: {
      parserOptions: { project: false },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
    },
  },
];
