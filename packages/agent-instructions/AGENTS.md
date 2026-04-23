# Shared agent instructions

> **Single source of truth** for cross-repo conventions in the
> precisa-saude ecosystem (fhir-brasil, medbench-brasil, datasus-brasil,
> platform, tooling). Published as `@precisa-saude/agent-instructions`
> on npm and consumed by each repo via imports in `CLAUDE.md`:
>
> ```markdown
> @./node_modules/@precisa-saude/agent-instructions/AGENTS.md
> @./AGENTS.md
> ```
>
> Each repo's local `AGENTS.md` holds only that repo's specific rules.
> Edit these shared rules via a PR in the `tooling` repo at
> `packages/agent-instructions/AGENTS.md` → `semantic-release` publishes
> → consumers update via `pnpm update @precisa-saude/agent-instructions`.

## Tone and communication

Do not open responses with "You're absolutely right" or other effusive
agreement phrases. Keep a professional, direct tone without unnecessary
excitement.

## Time estimates — calibrate to context or skip them

Default priors from tech blogs and migration guides assume team/enterprise
context: coordination, staged rollouts, review cycles, test matrices.
These repos are solo-dev projects in git worktrees — most of that tax
doesn't apply. Treating a 50-file import rename as "days" when it's
actually minutes is the failure mode.

- For reversible, scoped work: skip the estimate, just try it, report
  when blocked.
- If an estimate is needed, calibrate to a solo dev in a worktree with
  grep + `file:` deps, not a team shipping to prod.
- Express uncertainty in ranges based on what could actually fail, not
  in units of time.
- Don't conflate "this _involves_…" with "this _takes_…" — many
  nominal scope items collapse to a single file edit in practice.

## Language — en-US for agent instructions, pt-BR for user-facing text

Agent-facing configuration (this file, each repo's `AGENTS.md`, the
`CLAUDE.md` pointers) is written in **en-US**. It's infrastructure,
sits next to ESLint/TypeScript configs, and is read by tools and
contributors from many backgrounds.

**User-facing text stays in pt-BR** with full accentuation:
documentation, READMEs, CHANGELOG, issue templates, PR templates,
commit messages, and code comments aimed at a human reader.
Identifiers (types, functions, scripts, package names) stay English.

Never drop accents in pt-BR content — it looks careless and
unprofessional.

- Wrong: `definicoes`, `referencia`, `codigo`, `clinica`, `Instalacao`, `rapido`
- Right: `definições`, `referência`, `código`, `clínica`, `Instalação`, `rápido`

Commit messages: the type (`feat`, `fix`, `refactor`, etc.) stays
English by convention, but the description is pt-BR.

## Data integrity — never fabricate values

**CRITICAL**: when a value must come from an authoritative source
(official microdata, clinical guidelines, answer keys, LOINC codes,
model training cutoffs, etc.), **integrate the real source or
explicitly flag the gap**. Don't fill in with plausible values inferred
from a pattern, a similar name, or "probably this."

Anti-patterns to avoid:

- Completing a partial date (`2024-11` → `"14 nov. 2024"`) without
  opening the publication — record `nov. 2024` if the day isn't there.
- Inferring a model's `trainingCutoff` from its release date — if the
  vendor doesn't publish it, the field stays `undefined` and the model
  is classified as `unknown`.
- Copying a biomarker reference range from a commercial portal — cite
  SBPC/ML, WHO, PubMed, or flag the range as approximate.
- Generating DATASUS microdata values when the file is corrupted —
  open an issue and wait.

General rule: an explicit gap always beats a plausible-but-wrong value.
Wrong data becomes the basis for charts, decisions, releases, and
third-party citations.

## Verify sources and references before citing

When you add a reference of any kind — ABNT citation in docs, URL in
code, comment linking to an article, dataset source — **open the page
and confirm each field** before writing: byline author, publication
date, the institution that actually publishes (not the one hosting),
city. Never infer from a URL slug, domain, or acronym.

If a field can't be confirmed, use the ABNT conventions `[S. l.]` (no
location), `[S. n.]` (no publisher), or `[year]` instead of guessing.
Prefer an explicit gap over a plausible-but-wrong field.

Why: wrong references undermine the credibility of the page or package
they sit on. If a source is worth citing, it's worth opening.

### Sources to avoid

For any health, scientific, or clinical content cited across the
ecosystem (biomarkers, guidelines, methodologies, reference ranges),
avoid:

- `labtestsonline.org.br` — commercial lab-testing portal, not an
  authoritative academic source
- Generic organization homepages (e.g. `diabetes.org.br/`,
  `endocrino.org.br/`, `cardiol.br/`) — cite the specific publication,
  not the homepage

### Preferred sources (in this order)

1. PubMed articles (`pubmed.ncbi.nlm.nih.gov/PMID/`)
2. SciELO Brasil articles (`scielo.br/j/...`)
3. Official guideline PDFs (SBD, ABESO, SBC, SBPC/ML, WHO, Ministério
   da Saúde technical reports)
4. Society publications with DOI/ISBN (not homepage URLs)

Repo-specific additions (extra banned domains in a particular domain,
etc.) live in each repo's local `AGENTS.md`.

## Follow agreed plans — no silent deviations

**CRITICAL**: when implementing a feature based on an agreed plan (in
`docs/development/`, `.claude/plans/`, or a Linear issue), follow the
plan exactly or ask before deviating.

1. If a step looks complex, **ask first**: "This step requires X.
   Proceed, or prefer a simpler approach?"
2. If you want to simplify, **propose the change explicitly**: "I can
   do an MVP first. Works?"
3. **Never silently substitute** a simpler implementation for what was
   agreed.

## Test coverage — never regresses

When a coverage check fails, the fix is to add tests, not lower
thresholds. Coverage should increase over time.

1. Add tests covering the new or modified code
2. Focus on branch coverage (usually the hardest threshold)
3. Fluctuations within ~0.5% of the threshold are normal — cover the
   gap with a quick test rather than moving the threshold

Never disable the pre-push hook, never edit `vitest.config` to lower
the limit, never use `--no-verify` to push below threshold.

## Keep documentation up to date

When making significant changes, update the relevant documentation in
the same PR. Each repo maintains a specific "change type → files to
update" table in its local `AGENTS.md`. General rule: a new
package/feature/endpoint/script used by the user should appear
somewhere the user can find it.

## Code conventions — shared across all repos

All repos in the ecosystem share the same baseline:

- **Node 22**, **pnpm workspaces**, **Turborepo** for monorepo tasks
- **TypeScript strict** with `noUncheckedIndexedAccess` — enforced via
  `@precisa-saude/tsconfig`
- **ESM + CJS dual builds** via `tsup` for publishable packages
- **Vitest** for tests with an **80% coverage threshold** (branches,
  functions, lines, statements) per publishable package
- **ESLint** via `@precisa-saude/eslint-config`
- **Prettier** via `@precisa-saude/prettier-config`
- **Commitlint** via `@precisa-saude/commitlint-config` (Conventional
  Commits + AI-attribution blocking)
- **Husky** hooks for pre-commit (format + lint) and pre-push (lockfile
  - format + lint + typecheck + test)
- **Renovate** for automated dependency updates

Changes to any of these baselines should be proposed in `tooling` and
rolled out to consumers via `precisa sync` / `pnpm update`. Repo-level
overrides are allowed only when justified in the repo's local
`AGENTS.md` with the reason for diverging.

## Commits require explicit permission

**CRITICAL**: never create a commit without explicit user approval.
After making changes, announce the proposed commit message and wait for
confirmation before running `git commit`. This lets the user review
the changes, adjust the message, or decide to split across multiple
commits.

## No AI attribution in commits

Do not include `Co-Authored-By: Claude`, `Generated with Claude`, or
similar lines. The `commit-msg` hook blocks these patterns — don't try
to bypass.

## Always use pull requests

**CRITICAL**: never push directly to `main`. Always create a feature
branch and open a PR for review. Standard flow:

1. Create a feature branch from an up-to-date `main`
2. Commit on the feature branch
3. Push and open a PR
4. Merge via GitHub after review

If you accidentally committed to `main`:

```bash
git branch feature-branch
git reset --hard origin/main
git checkout feature-branch
git push -u origin feature-branch
gh pr create --title "..." --body "..."
```

## Never skip git hooks

**CRITICAL**: do not use `--no-verify`, `--no-gpg-sign`, or any flag
that bypasses hooks in `git commit`, `git push`, or other git commands.
If a hook fails, **fix the underlying issue**.

## Pull with rebase before committing

To keep history linear, always:

```bash
git pull --rebase origin main
```

Never use `git pull` without `--rebase` or `git merge` — both produce
merge commits.

## GPG signing

All commits are signed. Git global config already has
`commit.gpgsign = true`. Don't publish unsigned commits.

## Conventional Commits

Messages follow Conventional Commits (`type(scope): description`).
Valid scopes per repo are defined in `CONVENTIONS.md` when present.
Common types: `feat`, `fix`, `perf`, `refactor`, `docs`, `style`,
`test`, `ci`, `build`, `chore`, `revert`.

## Adding dependencies requires approval

**Always ask before adding npm dependencies.** Include:

- What the package does
- Why it's needed
- Bundle-size and peer-deps impact
- Whether an existing dep could serve

Repo-specific dependency boundaries (zero-runtime-dep packages,
allowed dep graphs, etc.) live in each repo's local `AGENTS.md`.

## Run lint and typecheck before committing

```bash
pnpm turbo run lint typecheck
```

Pre-push hooks run tests/coverage regardless, but catching issues
locally shortens the feedback loop.

## Permission prompts — be careful with "Always allow"

When the agent asks for approval to run a Bash command, **don't select
"Always allow"** for:

- Commands with heredocs or multi-line content (`cat > file << 'EOF' ...`)
- Commands with inline secrets (`TOKEN="..." curl ...`)
- Long commit messages (`git commit -m "multi-paragraph message"`)
- One-off commands that won't be reused verbatim

"Always allow" saves the complete command text to
`.claude/settings.local.json`. Complex commands can break the settings
parser (patterns with `:*` conflict with permission syntax) and leak
secrets into plaintext config.

**Use "Allow once"** for complex or one-off commands. Reserve "Always
allow" for short, reusable prefixes (`Bash(aws s3 ls:*)`).

## Responding to PR reviews — always reply and resolve

Whenever there are review comments (human or automated bot) on a PR
you're following:

1. **Read every comment** before moving on:

   ```bash
   gh api repos/OWNER/REPO/pulls/<N>/comments \
     --jq '.[] | {id, path, line, body: (.body | split("\n")[0])}'
   ```

2. **For each comment**:
   - **Implemented the suggestion**: reply citing the fix commit
     ("Addressed in `abc123`: <explanation>") and resolve the thread.
   - **Disagree or skipping**: reply with the technical reason. Resolve
     the thread.
   - **Need a user decision**: reply asking for clarification, do NOT
     resolve the thread, escalate.

3. **Reply via REST**:

   ```bash
   gh api -X POST repos/OWNER/REPO/pulls/<N>/comments/<COMMENT_ID>/replies \
     -f body="<text>"
   ```

4. **Resolve via GraphQL**:

   ```bash
   gh api graphql -f query='
     { repository(owner: "<o>", name: "<r>") {
         pullRequest(number: <n>) {
           reviewThreads(first: 50) {
             nodes { id isResolved comments(first: 1) { nodes { databaseId } } }
           }
         }
       } }'

   gh api graphql -f query='
     mutation { resolveReviewThread(input: { threadId: "<id>" }) { thread { isResolved } } }'
   ```

5. Fix commits in response to review cite `Refs: #<PR>` in the footer.

**Reply and resolve in batch — don't prompt per comment.** On PRs with
many comments, run all `gh api` calls in a single chained command or
loop.

**CRITICAL: reply and resolve BEFORE pushing the fix.** Sequence:

1. Commit locally (don't push yet)
2. Reply to every comment
3. Resolve every thread
4. Then push

Prevents the automated reviewer from running again immediately and
generating new comments before you've closed the existing ones.

Silence on review isn't neutral — it's debt. Close the loop.

### Autonomous polling after push — close the loop without being asked

After `gh pr create` or `git push` of a fix responding to review, **don't
wait for the user to ask whether new comments arrived**. Schedule a
check yourself with `ScheduleWakeup(delaySeconds: 270, ...)` — 270s
instead of 300s keeps the prompt cache warm (TTL is 5min).

On wake-up, follow the reply-and-resolve protocol above: list new
comments, reply, resolve threads. If there are fixes to apply, commit
→ reply → resolve → push, and **schedule the next round** with the
same delay. Stop after two consecutive rounds with no new comments, or
when the user says so.

Goal: shorten review latency. The user shouldn't need to ask "did the
comments arrive yet?"

## Worktrees for parallel sessions

**CRITICAL**: when more than one agent session might be active on the
repo, use a dedicated `git worktree` per feature. Sharing the working
tree across parallel sessions has already corrupted state (commits on
the wrong branch, files from another session ending up in `git add`).

Every repo with a frontend or dev server uses the shared
`@precisa-saude/worktree-cli` package. Per-repo port allocation,
service filters, and registry paths are declared in each repo's root
`package.json` under the `"worktree"` field.

Invoke via the package bin (preferred) or the backward-compat shim:

```bash
pnpm exec precisa-worktree list                    # all worktrees + ports + status
pnpm exec precisa-worktree setup feat/mine         # create + install + allocate
pnpm exec precisa-worktree dev                     # start dev servers (foreground)
pnpm exec precisa-worktree dev --detach            # background; logs to /tmp/
pnpm exec precisa-worktree dev --force             # kill conflicting port process
pnpm exec precisa-worktree stop                    # kill this worktree's servers
pnpm exec precisa-worktree logs --service=api      # tail a specific service
pnpm exec precisa-worktree teardown feat/mine      # cleanup after merge
./scripts/worktree.sh <cmd>                        # shim, equivalent to above
```

Commands that accept `[branch]` auto-detect the branch from `cwd` when
invoked inside a linked worktree. In the main worktree, pass the
branch explicitly.

Repos without a dev server (tooling itself, pure-library packages) use
plain `git worktree add` — the parallel-session rules still apply.

See `@precisa-saude/worktree-cli`'s
[README](https://github.com/Precisa-Saude/tooling/tree/main/packages/worktree-cli)
for the full config schema and command reference.

### Before starting any feature

1. Run `./scripts/worktree.sh list` and `git branch --show-current`.
   State which worktree/branch you're in.
2. If a worktree already exists for the feature, `cd` into it. Don't
   create a duplicate.
3. If none exists, run `./scripts/worktree.sh setup <branch>`.
4. **Never** run `git checkout <branch>` in the main worktree to
   "switch to the feature branch" — that changes the HEAD of a working
   tree another session may be using.

### During work

- Before `git add`, confirm `git branch --show-current`. If it changed
  since your last commit, STOP — another session touched the working
  tree.
- Run `git status` frequently. Files you didn't touch in this session
  are probably from another one; **don't** include them (`git add
<file>` explicit per path, never `git add -A` or `git add .`).
- `git reflog` when something feels off — it's the source of truth.
- **Each worktree runs its own services** on its allocated ports.
  Never redirect a worktree's frontend to the main worktree's API —
  the worktree may have backend changes specific to its branch.

### Starting a dev server in a worktree

`setup` allocates ports but does NOT start dev servers. Use:

- **Foreground** (blocks, good for inspecting output, Ctrl-C to stop):
  ```bash
  pnpm exec precisa-worktree dev
  ```
- **Detached** (backgrounded, survives the agent session, writes to
  `/tmp/<logPrefix>-<branch>.log` per service):
  ```bash
  pnpm exec precisa-worktree dev --detach
  ```

From an agent session, always use `--detach`; the foreground variant
will be killed when the Bash tool call times out.

Verify with e.g. `sleep 5 && curl -sI http://localhost:<PORT> | head -1`
using the port the CLI printed.

Exact port numbers, service filters, and env-var wiring are in each
repo's `package.json` under the `"worktree"` field — the CLI reads
them; each repo's `AGENTS.md` restates them for quick reference.

### Cleanup after merge

When asked to merge a PR, after the merge completes, **automatically
clean up**:

```bash
cd "$(repo main worktree)"
git pull --rebase origin main
pnpm exec precisa-worktree teardown <branch>
```

This stops the dev servers, removes the worktree, deletes the local
branch, frees the ports in the registry, and clears logs. Don't do any
of this manually. Pass `--keep-branch` to preserve the local branch.

## Plan persistence

Implementation plans created during conversations should be persisted
for reference across sessions:

1. **Location**: `docs/development/PLAN.md` (or a topical subfolder)
2. **Format**: markdown with Objective, Current status, Next steps,
   Context
3. **Update regularly** as work progresses
4. **Archive completed plans**: move to
   `docs/development/completed/YYYY-MM-DD-name.md`
