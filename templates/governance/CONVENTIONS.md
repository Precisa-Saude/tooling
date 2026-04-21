# Conventions

## Commit format

[Conventional Commits](https://www.conventionalcommits.org):

```
type(scope): short description

optional longer body

BREAKING CHANGE: notes (optional)
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `build`, `ci`, `revert`

**Scopes**: declared in `.commitlintrc.cjs`.

**AI attribution**: Do not include `Co-Authored-By: Claude`, `Generated with Claude`, or similar lines. The `commit-msg` hook enforces this.

## Code style

- TypeScript strict mode, `noUncheckedIndexedAccess`
- ESM modules
- Prettier-enforced formatting (100 char width, single quotes, semicolons, trailing commas — via `@precisa-saude/prettier-config`)
- ESLint rules via `@precisa-saude/eslint-config`
- Imports sorted by `eslint-plugin-simple-import-sort`
- Interfaces, objects, and JSX props sorted by `eslint-plugin-perfectionist` where applicable

## Tests

Vitest with an 80% coverage floor (configured per-repo in `vitest.config.ts`).

## Dependency rules

- Core/SDK packages avoid runtime dependencies when feasible
- External dependencies require explicit approval in the PR
