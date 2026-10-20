# @precisa-saude/tooling

Shared tooling, configs, design tokens, and a bootstrap CLI for the [Precisa Saúde](https://precisa-saude.com.br) ecosystem.

## What lives here

### npm packages (published to `@precisa-saude/*`)

| Package                                                              | Purpose                                                                                                              |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [`@precisa-saude/agent-instructions`](./packages/agent-instructions) | Single source of truth for `AGENTS.md` (shared rules for Claude Code / Cursor / Copilot across every consumer repo). |
| [`@precisa-saude/cli`](./packages/cli)                               | The `precisa` CLI — `new`, `scaffold`, `doctor`.                                                                     |
| [`@precisa-saude/commitlint-config`](./packages/commitlint-config)   | Conventional Commits + AI-attribution blocker.                                                                       |
| [`@precisa-saude/eslint-config`](./packages/eslint-config)           | Flat ESLint 9+ config. `base` (TS libraries), `react` (apps/sites), `node-backend` (Express), `html`.                |
| [`@precisa-saude/prettier-config`](./packages/prettier-config)       | Prettier config. Default + `/tailwind` variant.                                                                      |
| [`@precisa-saude/themes`](./packages/themes)                         | Design tokens (colors, CSS variables).                                                                               |
| [`@precisa-saude/tsconfig`](./packages/tsconfig)                     | `base.json`, `library.json`, `react.json`.                                                                           |
| [`@precisa-saude/ui`](./packages/ui)                                 | Shared React components (Base UI under the hood).                                                                    |
| [`@precisa-saude/worktree-cli`](./packages/worktree-cli)             | Git-worktree lifecycle CLI (`setup`/`dev`/`stop`/`teardown`/`list`/`logs`/`prune`).                                  |

### File templates

`templates/` holds the scaffolding rendered into consumer repos by the CLI — workflows, husky hooks, governance docs, dotfiles, `AGENTS.md` / `CLAUDE.md`, and sub-agent definitions. Rendered against each repo's `.precisa.json` manifest with token substitution.

## Adopting the tooling in a new repo

```bash
pnpm dlx @precisa-saude/cli new my-repo \
  --profile=oss-library \
  --non-interactive \
  --owner=Precisa-Saude \
  --scopes='core,docs,ci,deps'
```

Profiles:

- `oss-library` — public package(s), no site
- `oss-site` — public repo with a site
- `private-app` — private monorepo with its own deploy pipeline

The CLI renders 35+ files in one shot. Edit `.precisa.json` afterward if your scopes or profile change.

## Atualizações compartilhadas

Pacotes de configuração são estendidos localmente. Os workflows reutilizáveis
ficam neste repositório; consumidores os chamam por SHA com comentário de versão.
O Renovate propõe uma PR agrupada `precisa-tooling`, sem automerge, para revisar
a atualização e executar o CI do consumidor antes da adoção.

Os arquivos criados por templates pertencem ao repositório. Para adicionar um
arquivo ausente, use `precisa scaffold --only <caminho> --dry-run`. O comando
preserva arquivos existentes. `precisa sync` está descontinuado e não escreve.

`precisa doctor` verifica requisitos estruturais de configuração, comandos e
integração no CI. O workflow roda em PRs e pushes e não abre issues mensais por
diferenças de conteúdo. Lint, build e testes continuam nos jobs de CI.

## Workflows compartilhados

| Workflow           | Responsabilidade e extensão local                                  |
| ------------------ | ------------------------------------------------------------------ |
| `_checks.yml`      | Checks comuns; inputs `node_version`, `test_script` e `runs_on`    |
| `_release.yml`     | Release, com `require_package_changes` controlado pelo consumidor  |
| `_publish.yml`     | Publicação do `release_sha` e lista explícita de pacotes           |
| `_deploy-site.yml` | Projeto, filtro e diretórios de origem do site por inputs          |
| `review.yml`       | Revisão com política explícita, `pr_number`, exclusões e `runs_on` |

`ci.yml` pertence a cada consumidor e define triggers, permissões, dependências
entre jobs e checks específicos. Os inputs novos exigem uma release que já os
contenha. Veja [o contrato e a migração](docs/development/versioned-tooling.md).

Consulte [segurança e adoção dos workflows](docs/security.md) para a política de
exportação, permissões e recuperação de publicação.

## Known gotchas

- **Lockfile drift.** `pnpm install --frozen-lockfile` in CI fails if `package.json` changed without a matching `pnpm-lock.yaml` bump. Always stage both.
- **Format drift accumulates.** Running `pnpm format` once after adopting shared `@precisa-saude/prettier-config` produces a large initial diff; commit that separately from substantive changes.
- **`prettier-plugin-packagejson`** must be a peer dep of `@precisa-saude/prettier-config`, not a devDep in the consumer — otherwise `package.json` sorting won't apply.
- **`@precisa-saude/eslint-config/react`** default-scopes to `apps/{web,landing}`, `site/`, and `packages/ui`. For unusual layouts, use the `withFiles(['custom/**/*.tsx'])` factory export.
- **`skipLibCheck: true`** is default in the shared `tsconfig` — rarely want to turn it off; third-party `.d.ts` churn otherwise breaks builds.

## Releases

`ci.yml` chama `_release.yml` após os checks em pushes para `main`. Commits
relevantes em pacotes, templates ou workflows geram a versão e o changelog via
semantic-release. `_publish.yml` publica os pacotes a partir do SHA da release,
com o ambiente `npm-publish` preservado. Mudanças incompatíveis exigem
`BREAKING CHANGE` e uma migração documentada.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [CONVENTIONS.md](./CONVENTIONS.md).

Ao alterar templates ou inputs de workflows, documente os consumidores afetados e a ordem de atualização por PR.

## License

Apache-2.0 — see [LICENSE](./LICENSE).

A composição geométrica animada da marca é exportada por `@precisa-saude/ui/brand`.
Consulte [uso, acessibilidade e integração entre repositórios](packages/ui/README.md#composição-geométrica-da-marca).
