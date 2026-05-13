# @precisa-saude/worktree-cli

Shared `git worktree` lifecycle CLI for the Precisa Saúde ecosystem.
Drop-in replacement for each repo's hand-rolled `scripts/worktree.sh`.

- **One codebase, one behavior** across fhir-brasil, medbench-brasil,
  datasus-brasil, and platform.
- **Per-repo config** declared in `package.json` — no code fork.
- **Single-service and multi-service** repos supported uniformly
  (platform runs API + Web + Landing in one worktree; medbench/fhir run
  just the site).
- **Atomic port allocation** via a JSON registry on `/tmp/`, guarded by a
  `mkdir`-based lock portable to macOS and Linux.

## Install

```bash
pnpm add -D @precisa-saude/worktree-cli
```

## Configure

Add a `worktree` field to the repo's root `package.json`:

```json
{
  "worktree": {
    "directoryPrefix": "medbench-brasil",
    "portRegistry": "/tmp/medbench-worktree-ports.json",
    "buildCommand": "pnpm turbo run build --filter=./packages/*",
    "services": [
      {
        "name": "site",
        "mainPort": 4321,
        "featureBase": 4331,
        "increment": 10,
        "pnpmFilter": "@medbench-brasil/site",
        "logPrefix": "medbench-site"
      }
    ]
  }
}
```

### Multi-service example (platform)

```json
{
  "worktree": {
    "directoryPrefix": "platform",
    "portRegistry": "/tmp/precisa-worktree-ports.json",
    "services": [
      {
        "name": "api",
        "mainPort": 3000,
        "featureBase": 3010,
        "increment": 10,
        "pnpmFilter": "@precisasaude/api",
        "logPrefix": "precisa-api",
        "env": { "PORT": "{port}" }
      },
      {
        "name": "web",
        "mainPort": 5173,
        "featureBase": 5180,
        "increment": 10,
        "pnpmFilter": "@precisasaude/web",
        "logPrefix": "precisa-web",
        "env": { "VITE_API_URL": "http://localhost:{api_port}/api" }
      }
    ],
    "writeFiles": [
      { "path": "apps/api/.env.local", "contents": "PORT={api_port}\n" },
      {
        "path": "apps/web/.env.local",
        "contents": "VITE_DEV_PORT={web_port}\nVITE_API_URL=http://localhost:{api_port}/api\n"
      }
    ],
    "inheritEnvFromMain": ["apps/api/.env.local", "apps/web/.env.local"],
    "buildCommand": "pnpm turbo run build --filter='./packages/**'"
  }
}
```

`inheritEnvFromMain` appends KEY=VALUE lines from the main worktree's `.env.local` files into the new worktree's corresponding files at the end of `setup`. Port keys written by `writeFiles` are NOT overwritten — only missing keys are appended. Useful when the main worktree holds long-lived dev credentials (Cognito, Stripe, S3 buckets, DynamoDB tables) that every worktree needs but that aren't worktree-scoped.

`buildCommand` runs after `pnpm install` to pre-build workspace packages. Required when downstream apps load workspace deps via Node ESM (e.g. `apps/api` reading `packages/*/dist/index.js`) — without it, the API will crash with `ERR_MODULE_NOT_FOUND` on first start because `dist/` isn't populated.

## Usage

```bash
precisa-worktree setup feat/my-work        # create worktree, install, allocate ports
cd ../<prefix>-feat-my-work
precisa-worktree dev                        # start dev servers (foreground)
precisa-worktree dev --detach               # detached (writes to log files)
precisa-worktree dev --force                # kill processes on conflicting ports
precisa-worktree stop                       # kill this worktree's dev servers
precisa-worktree logs --service=api         # tail a specific service log
precisa-worktree list                       # show all worktrees + ports + status
precisa-worktree teardown feat/my-work      # stop, remove, delete branch, free ports
precisa-worktree teardown --keep-branch X   # preserve the local branch
```

Commands that take `[branch]` auto-detect from the working directory
when invoked inside a linked worktree. In the main worktree, pass the
branch explicitly.

## Drop-in migration from `scripts/worktree.sh`

Old:

```bash
./scripts/worktree.sh setup feat/my-work
./scripts/worktree.sh dev
./scripts/worktree.sh teardown feat/my-work
```

New:

```bash
pnpm exec precisa-worktree setup feat/my-work
pnpm exec precisa-worktree dev
pnpm exec precisa-worktree teardown feat/my-work
```

Or add a shim at `scripts/worktree.sh`:

```bash
#!/usr/bin/env bash
exec pnpm exec precisa-worktree "$@"
```

## How port allocation works

- Main worktree always uses `mainPort` (never allocated — reserved by convention).
- Feature worktrees get a slot starting at 1. Slot N allocates
  `featureBase + (N-1) * increment` for each service.
- Slots are recycled after teardown, so long-lived repos don't drift
  into high port numbers.
- The registry is a JSON file on `/tmp/` (survives across sessions,
  wiped by the OS between boots — safe default).
- A `mkdir`-based lock serializes concurrent setup/teardown across
  parallel agent sessions without requiring `flock` (macOS-compatible).

## Design goals

- **No surprise behavior change** relative to the hand-rolled scripts:
  same port allocation algorithm, same worktree directory naming, same
  log file paths.
- **Fail loudly on misconfiguration**: missing config field → immediate
  error with field name.
- **Cross-platform**: macOS (lsof) and Linux (ss, fuser) port probing;
  POSIX-atomic locking; no GNU-specific flags.
