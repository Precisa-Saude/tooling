# @precisa-saude/tooling

Shared tooling, configs, design tokens, and a bootstrap CLI for the [Precisa Saúde](https://precisa-saude.com.br) ecosystem.

## What lives here

### npm packages (published to `@precisa-saude/*`)

| Package                                                              | Purpose                                                                                                              |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [`@precisa-saude/agent-instructions`](./packages/agent-instructions) | Single source of truth for `AGENTS.md` (shared rules for Claude Code / Cursor / Copilot across every consumer repo). |
| [`@precisa-saude/cli`](./packages/cli)                               | The `precisa` CLI — `new`, `sync`, `doctor`.                                                                         |
| [`@precisa-saude/commitlint-config`](./packages/commitlint-config)   | Conventional Commits + AI-attribution blocker.                                                                       |
| [`@precisa-saude/eslint-config`](./packages/eslint-config)           | Flat ESLint 9+ config. `base` (TS libraries), `react` (apps/sites), `node-backend` (Express), `html`.                |
| [`@precisa-saude/prettier-config`](./packages/prettier-config)       | Prettier config. Default + `/tailwind` variant.                                                                      |
| [`@precisa-saude/themes`](./packages/themes)                         | Design tokens (colors, CSS variables).                                                                               |
| [`@precisa-saude/tsconfig`](./packages/tsconfig)                     | `base.json`, `library.json`, `react.json`.                                                                           |
| [`@precisa-saude/ui`](./packages/ui)                                 | Shared React components (Base UI under the hood).                                                                    |
| [`@precisa-saude/worktree-cli`](./packages/worktree-cli)             | Git-worktree lifecycle CLI (`setup`/`dev`/`stop`/`teardown`/`list`/`logs`).                                          |

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

## Keeping a repo in sync

```bash
# Preview what would change (with diffs)
pnpm dlx @precisa-saude/cli sync --dry-run

# Apply
pnpm dlx @precisa-saude/cli sync
```

Merge strategies:

- `overwrite` — for files whose canonical form lives in this repo (workflows, husky hooks, dotfiles, config pointers)
- `skip_if_exists` — for scaffold-only files (first render only)
- `preserve` — for docs that each repo curates (`CONTRIBUTING.md`, `CONVENTIONS.md`)

## Auditing drift

```bash
pnpm dlx @precisa-saude/cli doctor
```

Reports every manifest entry by status:

- `✓` ok — content matches the rendered template
- `i` info — differs but won't be touched by `sync`
- `!` warning — differs and `sync` would overwrite
- `✗` error — missing but required by the manifest profile

Consumer repos ship a `doctor.yml` workflow that runs monthly and opens an issue when drift is detected.

## Workflow pattern

Consumer repos use a split reusable-workflow pattern:

```
ci.yml              # orchestrator — triggers, permissions, concurrency, wiring
_checks.yml         # parallel: lint / typecheck / format / build / test + PR-title commitlint
_release.yml        # semantic-release with packages_changed guard (if publishing)
_publish.yml        # npm publish pinned to release_sha (if publishing)
_deploy-site.yml    # site deploy (if the repo has a site)
review.yml          # automated code review
publish-tag.yml     # manual recovery: publish a specific tag (if publishing)
doctor.yml          # monthly template drift audit
```

Tooling itself uses a standalone `release.yml` instead of `_release + _publish` — its `.precisa.json` has `publishesToNpm: false` to opt out of the split-release files.

## Known gotchas

- **Lockfile drift.** `pnpm install --frozen-lockfile` in CI fails if `package.json` changed without a matching `pnpm-lock.yaml` bump. Always stage both.
- **Format drift accumulates.** Running `pnpm format` once after adopting shared `@precisa-saude/prettier-config` produces a large initial diff; commit that separately from substantive changes.
- **`prettier-plugin-packagejson`** must be a peer dep of `@precisa-saude/prettier-config`, not a devDep in the consumer — otherwise `package.json` sorting won't apply.
- **`@precisa-saude/eslint-config/react`** default-scopes to `apps/{web,landing}`, `site/`, and `packages/ui`. For unusual layouts, use the `withFiles(['custom/**/*.tsx'])` factory export.
- **`skipLibCheck: true`** is default in the shared `tsconfig` — rarely want to turn it off; third-party `.d.ts` churn otherwise breaks builds.

## Release cadence

Tooling's `release.yml` runs on every push to `main` (no-op when no releasable commits) and on a weekly cron (Mondays 09:00 UTC) — the cron catches packages that have only docs/CI/chore commits since the last release.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [CONVENTIONS.md](./CONVENTIONS.md).

When changing `templates/**`, note in the PR which consumer repos should run `pnpm dlx @precisa-saude/cli sync` to absorb the change.

## License

Apache-2.0 — see [LICENSE](./LICENSE).
