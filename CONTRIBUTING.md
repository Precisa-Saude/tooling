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

Releases are automated via semantic-release on `main`. Versioning follows semver: `feat` → minor, `fix`/`perf` → patch, breaking changes (footer `BREAKING CHANGE:`) → major.
