// @ts-nocheck
import tsParser from '@typescript-eslint/parser';
import betterTailwindcss from 'eslint-plugin-better-tailwindcss';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import perfectionist from 'eslint-plugin-perfectionist';
import prettier from 'eslint-plugin-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';

import base from './base.js';

/**
 * React ESLint flat config. Extends `base` with React, React Hooks, JSX a11y,
 * React Refresh, and better-tailwindcss rules.
 *
 * Two usage patterns:
 *
 * 1) Default-scoped (most repos): import as the default export; it uses
 *    `REACT_PATHS` covering apps/web, apps/landing, site, packages/ui.
 *
 *    import reactConfig from '@precisa-saude/eslint-config/react';
 *    export default [...reactConfig];
 *
 * 2) Custom-scoped (repos with atypical layouts): import the `withFiles`
 *    factory and pass your own glob patterns. Use this when you need
 *    React rules to apply only to specific paths — typically because a
 *    Node/Express backend lives in a different directory that must not
 *    pick up React rules.
 *
 *    import { withFiles } from '@precisa-saude/eslint-config/react';
 *    export default [
 *      ...withFiles(['apps/{web,landing}/**\/*.{ts,tsx}', 'packages/ui/**\/*.{ts,tsx}']),
 *    ];
 */

// Default file patterns matching the ecosystem's React conventions:
//   - Platform: apps/web, apps/landing, packages/ui
//   - OSS repos with a site: site/
export const REACT_PATHS = [
  'apps/{web,landing}/**/*.{ts,tsx,jsx}',
  'site/**/*.{ts,tsx,jsx}',
  'packages/ui/**/*.{ts,tsx,jsx}',
];

/**
 * Build a React-rules block scoped to the given file globs. Returned as
 * an array for spread-compatibility with base:
 *
 *   [...base, ...withFiles([...paths])]
 */
export function withFiles(files) {
  return [...base, buildReactBlock(files)];
}

function buildReactBlock(files) {
  return {
    files,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: true,
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      'better-tailwindcss': betterTailwindcss,
      'jsx-a11y': jsxA11y,
      perfectionist,
      prettier,
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'simple-import-sort': simpleImportSort,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,

      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-uses-react': 'off',
      'react/jsx-uses-vars': 'error',

      'react-refresh/only-export-components': [
        'warn',
        { allowExportNames: ['badgeVariants', 'buttonVariants', 'toggleVariants'] },
      ],

      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/anchor-is-valid': ['error', { components: ['Link'], specialLink: ['to', 'href'] }],
      'jsx-a11y/no-autofocus': 'off',

      'no-console': ['warn', { allow: ['warn', 'error'] }],

      'perfectionist/sort-jsx-props': [
        'error',
        {
          type: 'alphabetical',
          order: 'asc',
          ignoreCase: true,
          groups: ['reserved', 'shorthand-prop', 'unknown', 'callback'],
          customGroups: [
            { groupName: 'reserved', elementNamePattern: '^(key|ref)$' },
            { groupName: 'callback', elementNamePattern: '^on.+' },
          ],
        },
      ],
    },
  };
}

const reactConfig = [...base, buildReactBlock(REACT_PATHS)];

export default reactConfig;
