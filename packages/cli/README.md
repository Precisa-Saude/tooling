# @precisa-saude/cli

The `precisa` CLI — scaffold new repos, sync existing ones, audit drift.

## Install

Run without installing:

```bash
pnpm dlx @precisa-saude/cli <command>
```

Or install globally:

```bash
pnpm add -g @precisa-saude/cli
precisa <command>
```

## Commands

### `precisa new <repo-name>`

Scaffold a new repository from the shared templates.

```bash
precisa new my-repo --profile oss-library
precisa new my-site --profile oss-site
precisa new internal-tool --profile private-app
```

Options:

- `--profile <profile>`: preset (`oss-library` | `oss-site` | `private-app`). Interactive prompts fill the rest.
- `--dry-run`: print what would be written without touching disk.

### `precisa sync`

Re-render templates against the current repo's `.precisa.json` manifest.

```bash
precisa sync           # apply (with confirmation)
precisa sync --dry-run # preview diff
```

Files are merged according to per-template strategy:

- **Overwrite**: workflows, hooks, `.editorconfig`, `.nvmrc`, governance boilerplate
- **Merge JSON**: managed keys in `package.json`
- **Preserve**: `CLAUDE.md`, `README.md`, `CONTRIBUTING.md` (emit diff only)

### `precisa doctor`

Audit the repo without writing anything.

```bash
precisa doctor
```

Exit code is non-zero if error-severity drift is found.

## `.precisa.json` manifest

Every consumer repo declares its profile:

```json
{
  "schemaVersion": 1,
  "visibility": "oss",
  "hasSite": true,
  "hasPackages": true,
  "publishesToNpm": true,
  "commitScopes": ["core", "docs", "ci", "deps"],
  "contactEmails": {
    "security": "security@precisa-saude.com.br",
    "conduct": "conduct@precisa-saude.com.br"
  },
  "nodeVersion": "22",
  "pnpmVersion": "9.15.9"
}
```

## Status

This package is **in early development**. The command shells and manifest schema are stable, but `new`, `sync`, and `doctor` currently print their planned behavior rather than executing it. Real implementation lands in subsequent releases.

## License

Apache-2.0
