// @ts-nocheck
import typescript from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

import base from './base.js';

/**
 * ESLint preset for Node.js backends (Express/Fastify/Hono/etc.).
 *
 * Extends `base` with:
 *   - Node globals (process, Buffer, __dirname, etc.)
 *   - `no-console: off` — backends legitimately log to stdout
 *   - Express-friendly `no-misused-promises` (async route handlers are
 *     void-returning by convention)
 *   - Relaxed type-safety warnings (external API surfaces pull in lots
 *     of `any`; turning these to errors is hostile on day one)
 *
 * File patterns match the ecosystem's backend conventions. Override
 * `BACKEND_PATHS` if you have a non-standard layout.
 *
 * Usage:
 *   import nodeBackend from '@precisa-saude/eslint-config/node-backend';
 *   export default [...nodeBackend];
 *
 * Platform-specific rules (e.g. restricted imports for LGPD compliance)
 * go in the consumer repo's eslint.config.js, not here.
 */
export const BACKEND_PATHS = ['apps/api/**/*.ts', 'apps/server/**/*.ts', 'packages/api-*/**/*.ts'];

const nodeBackend = [
  ...base,

  {
    files: BACKEND_PATHS,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: true,
      },
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      'no-console': 'off',

      // Express route handlers are async but void-returning. The
      // recommended rule has false positives here.
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { arguments: false } },
      ],

      // Backends pull types through lots of external API boundaries; full
      // strictness on day one is hostile. Warn, don't error.
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/require-await': 'warn',
    },
  },
];

export default nodeBackend;
