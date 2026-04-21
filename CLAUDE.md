# Claude instructions — @precisa-saude/tooling

Do not open responses with "You're absolutely right" or other effusive agreement phrases. Keep the tone professional and direct.

## What this repo is

The shared meta-tooling repo for the Precisa Saúde ecosystem. It publishes `@precisa-saude/*` npm packages (ESLint/Prettier/TS configs, design tokens, a UI library, and the `precisa` CLI), plus file templates consumed via the CLI by other repos.

## Rules

### No AI attribution in commits

The `commit-msg` hook blocks `Co-Authored-By: Claude` / `Generated with Claude` lines. Do not add them.

### Commits require permission

Never commit or push without explicit user approval. State the proposed commit message first.

### Always use PRs

Never push directly to `main`. Create a feature branch and open a PR.

### Never skip hooks

No `--no-verify`, no `--no-gpg-sign`. If a hook fails, fix the underlying issue.

### GPG signing

All commits signed. Git global config already has `commit.gpgsign = true`.

### Public repository

This is an Apache-2.0 public repo. Review every commit for content that should not be public. When in doubt, ask.

## Workflow

```bash
pnpm install
pnpm -r build
pnpm -r typecheck
pnpm -r test
pnpm -r lint
```

Before committing, run lint + typecheck:

```bash
pnpm turbo run lint typecheck
```

## Dependency additions

Ask before adding new npm dependencies. Include: what the package does, why it's needed, bundle-size / peer-dep impact, and whether an existing dep could serve.
