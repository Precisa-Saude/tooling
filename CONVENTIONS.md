# Conventions

## Language

- **Source code & identifiers**: English
- **User-facing CLI output**: English
- **Commit messages in this repo**: English (consumer repos may use their own language per their own conventions)

## Commit format

Conventional Commits:

```
type(scope): short description

optional longer body

BREAKING CHANGE: notes (optional)
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `build`, `ci`, `revert`

**Scopes**:

- `eslint` / `prettier` / `tsconfig` / `commitlint` — package-specific
- `themes` / `ui` — design system packages (when they land)
- `cli` — the `precisa` binary
- `templates` — files in `templates/`
- `docs` — documentation updates
- `ci` — workflows in `.github/`
- `deps` — dependency updates
- `release` — release plumbing

**AI attribution**: Do not include `Co-Authored-By: Claude`, `Generated with Claude`, or similar lines. The `commit-msg` hook enforces this.

## Code style

- TypeScript strict mode, `noUncheckedIndexedAccess`
- ESM modules only
- Prettier-enforced formatting (100 char width, single quotes, semicolons, trailing commas)
- Imports sorted by `eslint-plugin-simple-import-sort`
- Interfaces, objects, and JSX props sorted by `eslint-plugin-perfectionist` where applicable

## Package publishing

- All public packages are scoped `@precisa-saude/*`
- Apache-2.0 license
- ESM-only unless there's a concrete reason to dual-publish
- Declare `peerDependencies` honestly — don't bundle things consumers already install

## Dependency rules

- `@precisa-saude/eslint-config` peers on ESLint plugins, does not bundle them
- `@precisa-saude/prettier-config` ships JSON only
- `@precisa-saude/tsconfig` ships JSON only
- `@precisa-saude/commitlint-config` peers on `@commitlint/*`
- `@precisa-saude/cli` bundles its runtime deps via `tsup`

Ask before adding any new runtime dependency.
