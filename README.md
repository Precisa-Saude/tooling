# @precisa-saude/tooling

Shared tooling, configs, design tokens, and a bootstrap CLI for the [Precisa Saúde](https://precisa-saude.com.br) ecosystem.

## What lives here

### npm packages (published to `@precisa-saude/*`)

| Package                                                            | Purpose                                                             |
| ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| [`@precisa-saude/eslint-config`](./packages/eslint-config)         | Flat ESLint 9 config. `base` for libraries, `react` for apps/sites. |
| [`@precisa-saude/prettier-config`](./packages/prettier-config)     | Prettier config. Default + `/tailwind` variant.                     |
| [`@precisa-saude/tsconfig`](./packages/tsconfig)                   | `base.json`, `library.json`, `react.json`.                          |
| [`@precisa-saude/commitlint-config`](./packages/commitlint-config) | Conventional commits + AI-attribution blocker.                      |
| [`@precisa-saude/themes`](./packages/themes)                       | Design tokens (colors, CSS variables). _Planned._                   |
| [`@precisa-saude/ui`](./packages/ui)                               | Shared React components. _Planned._                                 |
| [`@precisa-saude/cli`](./packages/cli)                             | The `precisa` CLI.                                                  |

### File templates

`templates/` contains files rendered into consumer repos (workflows, hooks, governance docs, `.editorconfig`, `.nvmrc`, etc.). The CLI renders them against a repo's `.precisa.json` manifest.

## Usage

**Scaffold a new repo:**

```bash
pnpm dlx @precisa-saude/cli new my-repo
```

**Sync an existing repo:**

```bash
pnpm dlx @precisa-saude/cli sync
```

**Audit drift:**

```bash
pnpm dlx @precisa-saude/cli doctor
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [CONVENTIONS.md](./CONVENTIONS.md).

## License

Apache-2.0 — see [LICENSE](./LICENSE).
