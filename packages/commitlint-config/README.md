# @precisa-saude/commitlint-config

Shared commitlint config for Precisa Saúde repositories. Conventional Commits with per-repo scope configuration.

## Install

```bash
pnpm add -D @precisa-saude/commitlint-config @commitlint/cli
```

## Use

### Simple (default scopes only)

Default scopes: `docs`, `ci`, `deps`, `lint`, `config`, `release`.

```js
// .commitlintrc.cjs
module.exports = require('@precisa-saude/commitlint-config');
```

### Per-repo scopes (recommended)

Override `scope-enum` in your repo's config:

```js
// .commitlintrc.cjs
const base = require('@precisa-saude/commitlint-config');

module.exports = {
  ...base,
  rules: {
    ...base.rules,
    'scope-enum': [2, 'always', ['core', 'calculators', 'ocr-utils', 'rnds', 'docs', 'ci', 'deps']],
  },
};
```

### Per-repo scopes via env var

Set `PRECISA_COMMIT_SCOPES` before commitlint runs:

```bash
export PRECISA_COMMIT_SCOPES="api,web,landing,ui,deps"
```

Useful if you want to keep the same `.commitlintrc.cjs` across every repo and inject scopes from CI/env.

## AI-attribution blocking

This package configures commit message validation. The **block on `Co-Authored-By: Claude` / `Generated with Claude`** lives in the `commit-msg` husky hook (shipped separately in `@precisa-saude/tooling`'s template files — installed via `precisa new` or `precisa sync`). See the [tooling repo README](https://github.com/Precisa-Saude/tooling) for the hook template.

## Rules

| Rule                   | Value                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `type-enum`            | `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `revert`, `build`, `ci` |
| `scope-enum`           | from env or override                                                                         |
| `subject-max-length`   | 100                                                                                          |
| `body-max-line-length` | 100                                                                                          |
| `type-case`            | lower-case                                                                                   |
| `subject-empty`        | never                                                                                        |
| `subject-full-stop`    | never                                                                                        |

## License

Apache-2.0
