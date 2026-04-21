# Templates

Files rendered into consumer repositories by `@precisa-saude/cli`.

## Layout

Template source paths mirror the target-repo path (e.g. `templates/.github/workflows/ci.yml` lands at `<repo>/.github/workflows/ci.yml`). A single `templates.manifest.yml` at the root of this directory describes every file: what it renders to, when it's required, and how it merges with existing content.

## Placeholders

Templates use mustache-style tokens. Resolved against the consumer repo's `.precisa.json` manifest at render time.

| Token                  | Source                                 | Example                         |
| ---------------------- | -------------------------------------- | ------------------------------- |
| `{{REPO_NAME}}`        | manifest `name` / directory name       | `fhir-brasil`                   |
| `{{REPO_SLUG}}`        | GitHub `owner/name`                    | `Precisa-Saude/fhir-brasil`     |
| `{{OWNER_ORG}}`        | GitHub org                             | `Precisa-Saude`                 |
| `{{VISIBILITY}}`       | manifest `visibility`                  | `oss` / `private`               |
| `{{NODE_VERSION}}`     | manifest `nodeVersion`                 | `22`                            |
| `{{PNPM_VERSION}}`     | manifest `pnpmVersion`                 | `9.15.9`                        |
| `{{SECURITY_EMAIL}}`   | manifest `contactEmails.security`      | `security@precisa-saude.com.br` |
| `{{CONDUCT_EMAIL}}`    | manifest `contactEmails.conduct`       | `conduct@precisa-saude.com.br`  |
| `{{COMMIT_SCOPES}}`    | manifest `commitScopes` (comma-joined) | `core,docs,ci,deps`             |
| `{{HAS_SITE}}`         | manifest `hasSite`                     | `true` / `false`                |
| `{{HAS_PACKAGES}}`     | manifest `hasPackages`                 | `true` / `false`                |
| `{{PUBLISHES_TO_NPM}}` | manifest `publishesToNpm`              | `true` / `false`                |

Conditional sections use `{{#if KEY}}...{{/if}}` and `{{#unless KEY}}...{{/unless}}`.

## Manifest schema

Each template is declared in `templates.manifest.yml`:

```yaml
- source: path/under/templates/
  target: path/in/consumer/repo
  required_when: always | oss | private | has_site | has_packages | publishes_to_npm
  merge_strategy: overwrite | merge_json | preserve | skip_if_exists
  executable: false # optional; set true for shell scripts
```

`merge_strategy` values:

- **overwrite** — always replace the target with the rendered template
- **merge_json** — three-way merge for JSON files (template base → current → new template); preserves repo-local keys
- **preserve** — never overwrite; `sync` emits the rendered diff as a suggestion
- **skip_if_exists** — create only if the target doesn't exist; subsequent runs leave it alone

## CLI integration

`@precisa-saude/cli` (stub; full implementation pending) reads this manifest and renders templates against `.precisa.json`. See the `cli/` package for the rendering contract.
