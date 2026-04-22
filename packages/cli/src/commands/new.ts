import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';

import { applyTemplate } from '../lib/merge.js';
import { loadTemplateManifest, readTemplateSource, renderTokens } from '../lib/templates.js';
import {
  DEFAULT_MANIFEST_FIELDS,
  isRequired,
  type PrecisaManifest,
  tokenContext,
  writeManifest,
} from '../manifest.js';

export interface NewOptions {
  conductEmail?: string;
  dryRun: boolean;
  /** Skip interactive prompts; require --owner/--scopes/--*-email flags. */
  nonInteractive?: boolean;
  owner?: string;
  profile: string;
  /** Comma-separated list, e.g. "core,docs,ci,deps". */
  scopes?: string;
  securityEmail?: string;
}

const PROFILES = {
  'oss-library': {
    hasPackages: true,
    hasSite: false,
    publishesToNpm: true,
    visibility: 'oss',
  },
  'oss-site': {
    hasPackages: false,
    hasSite: true,
    publishesToNpm: false,
    visibility: 'oss',
  },
  'private-app': {
    hasPackages: true,
    hasSite: true,
    publishesToNpm: false,
    visibility: 'private',
  },
} as const satisfies Record<
  string,
  Pick<PrecisaManifest, 'visibility' | 'hasSite' | 'hasPackages' | 'publishesToNpm'>
>;

export async function runNew(repoName: string, opts: NewOptions): Promise<void> {
  const targetDir = resolve(process.cwd(), repoName);

  if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
    console.error(chalk.red(`\nError: ${targetDir} already exists and is not empty.`));
    process.exit(1);
  }

  const profile = PROFILES[opts.profile as keyof typeof PROFILES];
  if (!profile) {
    console.error(
      chalk.red(`\nError: unknown profile '${opts.profile}'. Choose one of:`),
      Object.keys(PROFILES).join(', '),
    );
    process.exit(1);
  }

  console.log(chalk.bold.cyan(`\nprecisa new ${repoName}`));
  console.log(chalk.dim(`profile: ${opts.profile}${opts.dryRun ? ' (dry-run)' : ''}`));
  console.log(chalk.dim(`target:  ${targetDir}\n`));

  const answers = opts.nonInteractive
    ? {
        commitScopes: (opts.scopes ?? 'docs,ci,deps')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        conductEmail: opts.conductEmail ?? 'conduct@precisa-saude.com.br',
        owner: opts.owner ?? 'Precisa-Saude',
        securityEmail: opts.securityEmail ?? 'security@precisa-saude.com.br',
      }
    : await prompts(
        [
          {
            initial: opts.owner ?? 'Precisa-Saude',
            message: 'GitHub owner (org or user):',
            name: 'owner',
            type: 'text',
          },
          {
            initial: opts.securityEmail ?? 'security@precisa-saude.com.br',
            message: 'Security contact email:',
            name: 'securityEmail',
            type: 'text',
          },
          {
            initial: opts.conductEmail ?? 'conduct@precisa-saude.com.br',
            message: 'Code-of-conduct contact email:',
            name: 'conductEmail',
            type: 'text',
          },
          {
            initial: opts.scopes ?? 'docs,ci,deps',
            message: 'Commit scopes (comma-separated):',
            name: 'commitScopes',
            separator: ',',
            type: 'list',
          },
        ],
        { onCancel: () => process.exit(1) },
      );

  const manifest: PrecisaManifest = {
    ...DEFAULT_MANIFEST_FIELDS,
    ...profile,
    commitScopes: answers.commitScopes,
    contactEmails: {
      conduct: answers.conductEmail,
      security: answers.securityEmail,
    },
    name: repoName,
    owner: answers.owner,
  };

  const spinner = ora('Rendering templates').start();
  try {
    if (!opts.dryRun) mkdirSync(targetDir, { recursive: true });

    const entries = loadTemplateManifest().filter((e) => isRequired(e.required_when, manifest));
    const context = tokenContext(manifest);

    let created = 0;
    let skipped = 0;

    for (const entry of entries) {
      const source = readTemplateSource(entry);
      const rendered = renderTokens(source, context);
      const outcome = applyTemplate({
        cwd: targetDir,
        dryRun: opts.dryRun,
        entry,
        rendered,
      });
      if (outcome.kind === 'create') created += 1;
      else if (outcome.kind === 'skip-exists') skipped += 1;
      else if (outcome.kind === 'error') {
        spinner.fail(`Failed on ${entry.target}`);
        console.error(chalk.red(outcome.message));
        process.exit(1);
      }
    }

    spinner.succeed(
      opts.dryRun
        ? `Would render ${created} file${created === 1 ? '' : 's'} (${skipped} skipped)`
        : `Rendered ${created} file${created === 1 ? '' : 's'} (${skipped} skipped)`,
    );

    if (opts.dryRun) return;

    writeManifest(targetDir, manifest);
    console.log(chalk.dim(`  wrote .precisa.json`));

    const gitStep = ora('git init + pnpm install').start();
    try {
      execSync('git init --initial-branch=main', { cwd: targetDir, stdio: 'pipe' });
      execSync('pnpm install', { cwd: targetDir, stdio: 'pipe' });
      gitStep.succeed('git init + pnpm install complete');
    } catch (err) {
      gitStep.warn(
        `git/pnpm setup skipped: ${(err as Error).message}. Run manually in ${targetDir}.`,
      );
    }

    console.log(chalk.bold.green(`\n✓ ${repoName} scaffolded at ${targetDir}`));
    console.log(chalk.dim('\nNext:'));
    console.log(chalk.dim(`  cd ${repoName}`));
    console.log(chalk.dim(`  # start adding your code`));
  } catch (err) {
    spinner.fail((err as Error).message);
    process.exit(1);
  }
}
