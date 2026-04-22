# @precisa-saude/agent-instructions

Single source of shared rules for AI coding agents (Claude Code,
Cursor, Copilot, etc.) across every Precisa Saúde repository.

## What it is

One `AGENTS.md` file with the cross-cutting conventions: tone, git,
hooks, reviews, worktrees, source verification, test coverage, code
conventions. Versioned and published to npm like any other package.
Consumed by reference (`@path` import) from each repo's `CLAUDE.md`,
with no duplication.

The [AGENTS.md](https://agents.md/) standard is open — Claude Code,
Codex, Cursor, Zed, and others support it via import or direct loading.

## How to consume

In each consumer repo:

```bash
pnpm add -D @precisa-saude/agent-instructions
```

In the repo's `CLAUDE.md` (Claude Code pointer):

```markdown
# Claude instructions

This repository follows the AGENTS.md convention. Shared rules across
the precisa-saude ecosystem live in `@precisa-saude/agent-instructions`,
and repo-specific rules live in `./AGENTS.md`.

@./node_modules/@precisa-saude/agent-instructions/AGENTS.md
@./AGENTS.md
```

The repo's local `AGENTS.md` contains only that repo's specific section
(structure, domain conventions, commit scopes, etc.). The shared base
lives in `node_modules` and is refreshed via
`pnpm update @precisa-saude/agent-instructions`.

## Reading the shared base on GitHub

Because the shared content is installed via npm, readers browsing a
consumer repo on GitHub won't see the base inline. To read it:

https://github.com/Precisa-Saude/tooling/blob/main/packages/agent-instructions/AGENTS.md

Each consumer repo includes a link to this URL at the top of its local
`AGENTS.md` so readers can find the shared rules.

## How to edit shared rules

1. Edit `packages/agent-instructions/AGENTS.md` in the `tooling` repo
2. Open a PR in `tooling` — the review bot checks the change
3. After merge, `semantic-release` publishes a new version to npm
4. Consumers pick it up via
   `pnpm update @precisa-saude/agent-instructions` (or Renovate /
   Dependabot automates it)

For rules specific to a single repo, edit that repo's local `AGENTS.md`
— don't touch the shared base.

## Language

This file and the shared base are in **en-US** — agent configuration
is infrastructure, sitting next to ESLint/TypeScript config, read by
tools and contributors from many backgrounds. User-facing content in
the ecosystem (READMEs, CHANGELOG, commit messages, issue/PR templates,
code comments aimed at readers) stays in pt-BR with full accentuation.
