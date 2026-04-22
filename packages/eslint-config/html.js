// @ts-nocheck
import html from '@html-eslint/eslint-plugin';

/**
 * ESLint preset for HTML files.
 *
 * Applies `@html-eslint` rules to `**\/*.html` with sensible defaults.
 * Separate from `base` because not every repo has HTML files and the
 * plugin pulls in its own parser.
 *
 * Usage:
 *   import htmlConfig from '@precisa-saude/eslint-config/html';
 *   export default [...base, ...htmlConfig];
 *
 * If you need to tighten or relax rules, add another block after this
 * one in your config array.
 */
const htmlConfig = [
  {
    files: ['**/*.html'],
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
    plugins: {
      '@html-eslint': html,
    },
    languageOptions: {
      parser: html.configs['flat/recommended'].languageOptions.parser,
    },
    rules: {
      '@html-eslint/sort-attrs': 'error',
    },
  },
];

export default htmlConfig;
