# @precisa-saude/eslint-config

Shared flat ESLint 9 config for Precisa Saúde repositories.

## Install

```bash
pnpm add -D @precisa-saude/eslint-config eslint prettier
```

## Use

### TypeScript library / Node backend

```js
// eslint.config.js
import base from '@precisa-saude/eslint-config/base';

export default [
  ...base,
  {
    // repo-local overrides
    ignores: ['packages/foo/data/**'],
  },
];
```

### React app or library

```js
// eslint.config.js
import reactConfig from '@precisa-saude/eslint-config/react';

export default [
  ...reactConfig,
  {
    settings: {
      'better-tailwindcss': { tailwindConfig: './tailwind.config.js' },
    },
  },
];
```

## What it includes

- TypeScript (strict-friendly) via `@typescript-eslint`
- Import sorting via `simple-import-sort`
- Object/interface/JSX-prop sorting via `perfectionist`
- Prettier integration via `eslint-plugin-prettier` + `eslint-config-prettier`
- React (base + hooks + a11y + refresh + better-tailwindcss) via `/react`

All plugins are bundled as dependencies — you only need to add `eslint` and `prettier` yourself.

## License

Apache-2.0
