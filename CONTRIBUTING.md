# Contributing

Thanks for considering a contribution. This repo publishes shared configs and tooling that other projects consume, so changes here ripple outward — please read carefully.

## Development

```bash
pnpm install
pnpm -r build
pnpm -r typecheck
pnpm -r test
```

Node 22+ and pnpm 9.15.9+ are required (see `.nvmrc` and the `packageManager` field).

## Workflow

1. Fork (or branch) from `main`
2. Open a PR — direct pushes to `main` are not allowed
3. CI must be green
4. A reviewer approves and merges via GitHub

Commits follow [Conventional Commits](https://www.conventionalcommits.org). See [CONVENTIONS.md](./CONVENTIONS.md) for allowed scopes and commit-message rules.

## Dependency changes

Ask before adding runtime or peer dependencies. In the PR description explain: what the package does, why it's needed, and whether an existing dependency could serve the purpose.

## Testing your changes against consumers

Before cutting a release, verify the change against a consumer repo using pnpm's `link`:

```bash
cd packages/eslint-config
pnpm link --global
cd ../../path/to/consumer-repo
pnpm link --global @precisa-saude/eslint-config
pnpm lint
```

Revert with `pnpm unlink --global @precisa-saude/eslint-config` in the consumer repo.

## Releasing

Every merge to `main` triggers a full release cycle via `.github/workflows/release.yml`:

1. **Commit analysis** — conventional-commits determines the next semver.
2. **Version sync** — `scripts/sync-versions.cjs` bumps every non-private `packages/*/package.json` to the new version. Packages with `"private": true` are skipped.
3. **Publish** — `pnpm -r --filter "./packages/*" publish --access public` ships every public package to npm at the new version (all at the same version; consumers can pin each package independently).
4. **Git + GitHub** — updates `CHANGELOG.md`, commits the bumped versions with `[skip ci]`, creates a GitHub release.

Versioning rules (see `.releaserc.cjs`):

| Commit type                                          | Bump  |
| ---------------------------------------------------- | ----- |
| `feat`                                               | minor |
| `fix` / `perf` / `refactor`                          | patch |
| `revert`                                             | patch |
| `BREAKING CHANGE:` in footer                         | major |
| `docs` / `style` / `test` / `ci` / `chore` / `build` | none  |

### Skipping a release

Include `[skip ci]` anywhere in the commit body to skip the release workflow entirely. Use sparingly — the standard flow is to let every merge pass through.

### Local dry-run

To see what semantic-release would do without touching anything:

```bash
pnpm exec semantic-release --dry-run --no-ci
```

This runs the commit analysis and prints the intended version / changelog without writing to the registry or the repo.
