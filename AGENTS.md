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

## Shared tooling updates

Templates scaffold repository-owned files. Never ask consumers to run a
blanket sync. Shared behavior lives in versioned packages and reusable
workflows; Renovate proposes updates to their pinned versions.

When changing templates or workflow inputs, document the consumer rollout
and release dependency in the PR. `precisa scaffold --only <path>` only
adds missing files. `precisa doctor` checks repository requirements.

Shared rules remain in `packages/agent-instructions/AGENTS.md`; consumers
adopt the published version through dependency update PRs.
