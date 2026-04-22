// @ts-nocheck
import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';
import perfectionist from 'eslint-plugin-perfectionist';
import prettier from 'eslint-plugin-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';

/**
 * Base ESLint flat config for TypeScript libraries and Node.js backends.
 *
 * Usage:
 *   import base from '@precisa-saude/eslint-config/base';
 *   export default [
 *     ...base,
 *     { ignores: ['custom-ignore/**'] },
 *   ];
 */
const base = [
  js.configs.recommended,

  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/.turbo/**'],
  },

  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: true,
      },
      globals: {
        ...globals.es2022,
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      perfectionist,
      prettier,
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      ...prettierConfig.rules,

      'prettier/prettier': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',

      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],

      'no-console': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'no-throw-literal': 'error',
      'no-undef': 'off',

      // Size limits — forcing decomposition before files/functions get
      // unreadable. Thresholds are warns, not errors, so one-off
      // offenders don't block landing. Data/mapping files should be
      // ignored via `overrides` or per-repo `ignores`.
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],

      'perfectionist/sort-interfaces': [
        'error',
        {
          type: 'alphabetical',
          order: 'asc',
          ignoreCase: true,
          groups: ['unknown', 'callback'],
          customGroups: [{ groupName: 'callback', elementNamePattern: '^on.+' }],
        },
      ],
      'perfectionist/sort-objects': [
        'error',
        { type: 'alphabetical', order: 'asc', ignoreCase: true },
      ],
    },
  },

  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', '**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      'perfectionist/sort-objects': 'off',
      // Testes data-driven (tabelas de casos, fixtures inline) legitimamente
      // passam do limite de linhas; fragmentar esconderia o tamanho real
      // dos cenários testados em vez de melhorar manutenibilidade.
      'max-lines': 'off',
      'max-lines-per-function': 'off',
    },
  },

  {
    files: ['**/*.config.{js,ts,cjs,mjs}', '**/vitest.config.*', '**/vite.config.*'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: false,
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      prettier,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      'no-console': 'off',
      'no-undef': 'off',
      'prettier/prettier': 'error',
      'prefer-const': 'error',
    },
  },

  {
    files: ['**/*.cjs', '**/*.mjs', '**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
    },
  },
];

export default base;
