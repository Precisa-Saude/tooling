# Specific instructions — @precisa-saude/tooling

> This repository **is the origin** of the shared rules for the
> precisa-saude ecosystem. The shared base lives at
> `packages/agent-instructions/AGENTS.md` — that file is published as
> `@precisa-saude/agent-instructions` on npm and consumed by the other
> repos.
>
> This root file holds only what's specific to `tooling` itself. Claude
> Code loads both via imports in `CLAUDE.md`.
>
> To edit shared rules, change `packages/agent-instructions/AGENTS.md`
> — `semantic-release` publishes on merge to `main`.

## What this repo is

The shared meta-tooling repo for the Precisa Saúde ecosystem. Publishes
`@precisa-saude/*` npm packages (ESLint/Prettier/TS/commitlint configs,
design tokens, UI library, `precisa` CLI, `@precisa-saude/agent-instructions`)
plus file templates consumed via the CLI by other repos.

## Public repository (Apache-2.0)

Review every commit for content that shouldn't be public. When in
doubt, ask.

## Dependency rules — strict

Every runtime dependency ends up in every consumer's bundle. Before
adding:

- Written justification (what it does, why it's needed)
- Impact on consumers' peer-deps tree
- Alternatives considered
- `devDependency` or `runtime`?

## Sync after editing templates

Edits under `templates/**` don't propagate automatically to consumer
repos. After changing a template, document in the PR which repo(s)
need to run `precisa sync` to absorb the change.

Edits to `packages/agent-instructions/AGENTS.md` in particular: this is
the source of truth for shared agent rules. Consumers update via
`pnpm update @precisa-saude/agent-instructions` (or Renovate/Dependabot).
