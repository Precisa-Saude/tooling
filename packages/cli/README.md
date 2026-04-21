# @precisa-saude/cli

The `precisa` CLI — scaffold new repos, sync existing ones, audit drift against the shared template set.

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

- `--profile <profile>` — preset. One of:
  - `oss-library` — public repo that publishes npm packages (default)
  - `oss-site` — public repo with a website, no npm publish
  - `private-app` — internal repo with a website + packages, no npm publish
- `--dry-run` — print the planned file list without writing.

Interactive prompts ask for the GitHub owner, contact emails, and commit scopes. After rendering, the CLI runs `git init` and `pnpm install` in the new directory.

### `precisa sync`

Re-render templates against the current repo's `.precisa.json` manifest.

```bash
precisa sync            # apply
precisa sync --dry-run  # preview (shows unified diffs)
```

Per-file merge strategies (declared in `templates/templates.manifest.yml`):

- **overwrite** — replace the target; source of truth is the template.
- **merge_json** — three-way-ish JSON merge: repo-local keys win on conflicts; template adds missing keys.
- **preserve** — never overwrite; `sync` prints the diff as a suggestion.
- **skip_if_exists** — create only if the target doesn't exist.

Output per file:

| Icon          | Meaning                                                                   |
| ------------- | ------------------------------------------------------------------------- |
| `+` create    | Target didn't exist; rendered from template                               |
| `~` update    | Target existed; overwritten (dry-run shows unified diff)                  |
| `~` merge     | JSON merge applied                                                        |
| `i` preserve  | Target differs from template; left in place (dry-run shows would-be diff) |
| `=` unchanged | Target already matches template                                           |
| `s` skip      | Target exists; skip_if_exists prevented change                            |
| `!` error     | JSON parse error or unknown merge strategy                                |

### `precisa doctor`

Audit the repo without writing anything.

```bash
precisa doctor
```

Reports per template:

- ✓ **ok** — present and matches template
- ! **warning** — present but differs (run `sync` to update)
- ✗ **error** — required template is missing
- i **info** — preserve-strategy template differs (suggestion only, not drift)

Exits non-zero on any error-severity drift.

## `.precisa.json` manifest

Every consumer repo declares its profile:

```json
{
  "schemaVersion": 1,
  "name": "my-repo",
  "owner": "Precisa-Saude",
  "visibility": "oss",
  "hasSite": true,
  "hasPackages": true,
  "publishesToNpm": true,
  "commitScopes": ["core", "calculators", "ocr-utils", "rnds", "docs", "ci", "deps"],
  "contactEmails": {
    "security": "security@precisa-saude.com.br",
    "conduct": "conduct@precisa-saude.com.br"
  },
  "nodeVersion": "22",
  "pnpmVersion": "9.15.9"
}
```

The manifest is the single source of truth for which templates apply (`required_when` gates match `visibility` / `hasSite` / `hasPackages` / `publishesToNpm`) and which values get substituted into `{{TOKEN}}` placeholders.

## Template tokens

| Token                                                        | Source                                     |
| ------------------------------------------------------------ | ------------------------------------------ |
| `{{REPO_NAME}}`                                              | manifest `name`                            |
| `{{OWNER_ORG}}`                                              | manifest `owner`                           |
| `{{REPO_SLUG}}`                                              | `${owner}/${name}`                         |
| `{{VISIBILITY}}`                                             | manifest `visibility`                      |
| `{{NODE_VERSION}}`                                           | manifest `nodeVersion` (default: `22`)     |
| `{{PNPM_VERSION}}`                                           | manifest `pnpmVersion` (default: `9.15.9`) |
| `{{SECURITY_EMAIL}}`                                         | manifest `contactEmails.security`          |
| `{{CONDUCT_EMAIL}}`                                          | manifest `contactEmails.conduct`           |
| `{{COMMIT_SCOPES}}`                                          | manifest `commitScopes` (comma-joined)     |
| `{{HAS_SITE}}` / `{{HAS_PACKAGES}}` / `{{PUBLISHES_TO_NPM}}` | boolean manifest fields                    |

Unknown tokens are left untouched so missing keys are visible in output.

## License

Apache-2.0
