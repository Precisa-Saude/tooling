import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import chalk from 'chalk';

import { colorDiff } from '../lib/diff.js';
import { type ApplyOutcome, applyTemplate } from '../lib/merge.js';
import { loadTemplateManifest, readTemplateSource, renderTokens } from '../lib/templates.js';
import { isRequired, loadManifest, tokenContext } from '../manifest.js';

export interface SyncOptions {
  dryRun: boolean;
}

export async function runSync(opts: SyncOptions): Promise<void> {
  const cwd = process.cwd();
  console.log(chalk.bold.cyan(`\nprecisa sync${opts.dryRun ? ' --dry-run' : ''}`));

  let manifest;
  try {
    manifest = loadManifest(cwd);
  } catch (err) {
    console.error(chalk.red(`\n${(err as Error).message}`));
    console.error(
      chalk.dim('\n  Run `precisa new <repo>` in an empty directory to scaffold a new repo,'),
    );
    console.error(chalk.dim('  or create a `.precisa.json` manifest manually.'));
    process.exit(1);
  }

  const entries = loadTemplateManifest().filter((e) => isRequired(e.required_when, manifest));
  const context = tokenContext(manifest);

  const outcomes: ApplyOutcome[] = [];
  for (const entry of entries) {
    const source = readTemplateSource(entry);
    const rendered = renderTokens(source, context);
    outcomes.push(
      applyTemplate({
        cwd,
        dryRun: opts.dryRun,
        entry,
        rendered,
      }),
    );
  }

  console.log('');
  for (const o of outcomes) {
    printOutcome(o, opts.dryRun);
  }

  const summary = summarize(outcomes);
  console.log('');
  console.log(
    chalk.dim(
      `${summary.create} create, ${summary.update} update, ${summary.mergeJson} merge-json, ${summary.preserve} preserve, ${summary.skip} skip, ${summary.error} error`,
    ),
  );

  printPostSyncReminders(cwd, outcomes);

  if (summary.error > 0) process.exit(1);
}

// Best-effort reminders for steps that have to happen in the GitHub UI
// (creating environments, setting up required reviewers) that this CLI
// cannot do remotely. Triggered when a workflow that depends on the
// reminder was actually written or already present in the repo.
function printPostSyncReminders(cwd: string, outcomes: ApplyOutcome[]): void {
  const touched = outcomes
    .filter((o) => o.kind === 'create' || o.kind === 'update')
    .map((o) => o.target);

  const publishYml = join(cwd, '.github/workflows/_publish.yml');
  const hasPublishWorkflow = existsSync(publishYml);
  const publishReferencesEnv =
    hasPublishWorkflow &&
    readFileSync(publishYml, 'utf8').includes('environment:') &&
    readFileSync(publishYml, 'utf8').includes('npm-publish');

  const publishTouched = touched.some((t) => t.endsWith('_publish.yml'));
  if (publishReferencesEnv && publishTouched) {
    console.log('');
    console.log(chalk.bold.yellow('Post-sync — manual GitHub setup'));
    console.log(
      chalk.dim(
        '  Settings → Environments → npm-publish must exist with at least one required reviewer.',
      ),
    );
    console.log(
      chalk.dim(
        '  Without it the publish step runs unattended. The CLI cannot create environments remotely.',
      ),
    );
  }

  const watchTouched = touched.some((t) => t.endsWith('publish-watch.yml'));
  if (watchTouched) {
    console.log('');
    console.log(chalk.bold.yellow('Post-sync — publish-watch'));
    console.log(
      chalk.dim(
        '  publish-watch.yml now runs every 15 min. Confirm npm package names in `packages/**` are',
      ),
    );
    console.log(
      chalk.dim(
        '  current and that semantic-release tag convention (`<name>@<ver>` or `v<ver>`) matches.',
      ),
    );
  }
}

interface Summary {
  create: number;
  error: number;
  mergeJson: number;
  preserve: number;
  skip: number;
  update: number;
}

function summarize(outcomes: ApplyOutcome[]): Summary {
  const s: Summary = { create: 0, error: 0, mergeJson: 0, preserve: 0, skip: 0, update: 0 };
  for (const o of outcomes) {
    switch (o.kind) {
      case 'create':
        s.create += 1;
        break;
      case 'update':
        s.update += 1;
        break;
      case 'merge-json':
        s.mergeJson += 1;
        break;
      case 'preserve':
        s.preserve += 1;
        break;
      case 'skip-identical':
      case 'skip-exists':
        s.skip += 1;
        break;
      case 'error':
        s.error += 1;
        break;
    }
  }
  return s;
}

function printOutcome(o: ApplyOutcome, dryRun: boolean): void {
  const prefix = dryRun ? '(dry-run) ' : '';
  switch (o.kind) {
    case 'create':
      console.log(`${chalk.green('+')} ${prefix}create    ${o.target}`);
      return;
    case 'update':
      console.log(`${chalk.yellow('~')} ${prefix}update    ${o.target}`);
      if (dryRun) console.log(indent(colorDiff(o.target, o.previous, o.rendered)));
      return;
    case 'merge-json':
      console.log(`${chalk.yellow('~')} ${prefix}merge     ${o.target}`);
      if (dryRun) console.log(indent(colorDiff(o.target, o.previous, o.rendered)));
      return;
    case 'preserve':
      console.log(
        `${chalk.blue('i')} ${prefix}preserve  ${o.target} (template differs; not written)`,
      );
      if (dryRun && o.current !== o.rendered) {
        console.log(indent(colorDiff(o.target, o.current, o.rendered)));
      }
      return;
    case 'skip-identical':
      console.log(`${chalk.dim('=')} ${prefix}unchanged ${o.target}`);
      return;
    case 'skip-exists':
      console.log(`${chalk.dim('s')} ${prefix}skip      ${o.target} (already exists)`);
      return;
    case 'error':
      console.log(`${chalk.red('!')} ${prefix}error     ${o.target}: ${o.message}`);
      return;
  }
}

function indent(text: string): string {
  return text
    .split('\n')
    .map((l) => `      ${l}`)
    .join('\n');
}
