# Contributing

Thanks for considering a contribution to `{{REPO_NAME}}`.

## Development

```bash
pnpm install
pnpm -r build
pnpm -r typecheck
pnpm -r test
pnpm -r lint
```

Node {{NODE_VERSION}}+ and pnpm {{PNPM_VERSION}}+ are required (see `.nvmrc` and the `packageManager` field).

## Workflow

1. Fork (or branch) from `main`
2. Open a PR — direct pushes to `main` are not allowed
3. CI must be green
4. A reviewer approves and merges via GitHub

Commits follow [Conventional Commits](https://www.conventionalcommits.org). Allowed scopes for this repo are configured in `.commitlintrc.cjs`.

## Dependency changes

Ask before adding runtime or peer dependencies. In the PR description explain: what the package does, why it's needed, and whether an existing dependency could serve the purpose.

## Signing

All commits should be GPG-signed. The `commit-msg` hook blocks AI-attribution footers (`Co-Authored-By: Claude` and similar).
