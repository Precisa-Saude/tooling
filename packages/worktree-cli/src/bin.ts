#!/usr/bin/env node
import { rmdirSync } from 'node:fs';

import chalk from 'chalk';
import { Command } from 'commander';

import { dev } from './commands/dev.js';
import { list } from './commands/list.js';
import { logs } from './commands/logs.js';
import { setup } from './commands/setup.js';
import { stop } from './commands/stop.js';
import { teardown } from './commands/teardown.js';
import { loadConfig, lockDir, type WorktreeConfig } from './config.js';
import { detectBranch, findRepoRoot, mainWorktreeRoot } from './paths.js';

async function main(): Promise<void> {
  const program = new Command();
  program
    .name('precisa-worktree')
    .description('Git-worktree lifecycle CLI for Precisa Saúde repositories')
    .version('1.0.4');

  program
    .command('setup <branch>')
    .description('Create a worktree, install deps, allocate ports')
    .action(async (branch: string) => {
      const { cfg, mainRoot } = await resolveContext({ requireMain: true });
      await setup({ branch, cfg, repoRoot: mainRoot });
    });

  program
    .command('dev [branch]')
    .description('Start dev server(s) on the allocated ports')
    .option('-d, --detach', 'Run detached (nohup-style); write to log files', false)
    .option('-f, --force', 'Kill any process already on the port', false)
    .action(async (branchArg: string | undefined, opts: { detach: boolean; force: boolean }) => {
      const { branch, cfg, wtRoot } = await resolveContext({ allowDetect: true, branchArg });
      await dev({ branch, cfg, detach: opts.detach, force: opts.force, repoRoot: wtRoot });
    });

  program
    .command('stop [branch]')
    .description('Kill dev server(s) for a worktree')
    .action(async (branchArg?: string) => {
      const { branch, cfg } = await resolveContext({ allowDetect: true, branchArg });
      await stop({ branch, cfg });
    });

  program
    .command('teardown <branch>')
    .description('Stop dev servers, remove worktree, delete branch, free ports')
    .option('--keep-branch', 'Preserve the local branch', false)
    .action(async (branch: string, opts: { keepBranch: boolean }) => {
      const { cfg, mainRoot } = await resolveContext({ requireMain: true });
      await teardown({ branch, cfg, keepBranch: opts.keepBranch, repoRoot: mainRoot });
    });

  program
    .command('list')
    .description('List all worktrees with ports and status')
    .action(async () => {
      const { cfg, mainRoot } = await resolveContext({ requireMain: true });
      await list({ cfg, repoRoot: mainRoot });
    });

  program
    .command('logs [branch]')
    .description('Tail the log for a worktree dev server')
    .option('-s, --service <name>', 'Service name (defaults to the first configured)')
    .action(async (branchArg: string | undefined, opts: { service?: string }) => {
      const { branch, cfg } = await resolveContext({ allowDetect: true, branchArg });
      await logs({ branch, cfg, service: opts.service });
    });

  // Global EXIT handler — release the lock if we died mid-operation.
  // Safe because `rmdir` only succeeds on an empty directory we created.
  process.on('exit', () => {
    try {
      // Best-effort; we don't know the config if we failed before loading it.
      // This handler is installed after config load via resolveContext.
    } catch {
      // ignore
    }
  });

  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    console.error(chalk.red((err as Error).message));
    process.exit(1);
  }
}

interface ResolveOpts {
  /** Allow `detectBranch()` when inside a linked worktree. */
  allowDetect?: boolean;
  branchArg?: string | undefined;
  /** Require the repo root to be the main worktree (setup/teardown/list). */
  requireMain?: boolean;
}

async function resolveContext(opts: ResolveOpts): Promise<{
  cfg: WorktreeConfig;
  wtRoot: string;
  mainRoot: string;
  branch: string;
}> {
  const wtRoot = findRepoRoot();
  const mainRoot = mainWorktreeRoot();
  const cfg = await loadConfig(mainRoot);

  // Install an exit handler now that we know the lock path.
  const lockPath = lockDir(cfg);
  process.on('exit', () => {
    try {
      rmdirSync(lockPath);
    } catch {
      // already released or never held
    }
  });

  let branch = opts.branchArg ?? '';
  if (!branch && opts.allowDetect) {
    branch = detectBranch(cfg) ?? '';
  }

  if (!branch && !opts.requireMain) {
    console.error(
      chalk.red(
        "Couldn't detect branch. Run from inside a linked worktree or pass the branch name.",
      ),
    );
    process.exit(1);
  }

  return { branch, cfg, mainRoot, wtRoot };
}

void main();
