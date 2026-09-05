/* eslint-disable no-console -- CLI de setup: imprime progresso no console de propósito */
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import chalk from 'chalk';

import { type WorktreeConfig } from '../config.js';
import { buildInheritedAppend } from '../env-merge.js';
import { logFile, worktreePath } from '../paths.js';
import { allocate } from '../registry.js';

export interface SetupOptions {
  branch: string;
  cfg: WorktreeConfig;
  repoRoot: string;
}

export async function setup({ branch, cfg, repoRoot }: SetupOptions): Promise<void> {
  const wtPath = worktreePath(cfg, repoRoot, branch);

  if (existsSync(wtPath)) {
    console.error(chalk.red(`Worktree already exists: ${wtPath}`));
    console.error(`To start dev servers: precisa-worktree dev ${branch}`);
    process.exit(1);
  }

  console.log(chalk.bold(`==> Creating worktree for '${branch}' at ${wtPath}...`));

  // Fetch origin/main from the main worktree; a fresh worktree branches from it.
  execFileSync('git', ['-C', repoRoot, 'fetch', 'origin', 'main'], { stdio: 'inherit' });

  // If the branch already exists (local or remote-tracking), check it out
  // into the new worktree instead of creating a fresh branch — otherwise
  // `git worktree add -b` errors out on the duplicate.
  const reuseExisting = branchExists(repoRoot, branch);
  const addArgs = reuseExisting
    ? ['-C', repoRoot, 'worktree', 'add', wtPath, branch]
    : ['-C', repoRoot, 'worktree', 'add', '-b', branch, wtPath, 'origin/main'];
  execFileSync('git', addArgs, { stdio: 'inherit' });

  const entry = await allocate(cfg, branch);

  if (cfg.install !== false) {
    const seeded = seedNodeModules(repoRoot, wtPath);
    console.log(
      chalk.bold(
        seeded
          ? '==> Installing dependencies (pnpm install, node_modules pre-cloned)...'
          : '==> Installing dependencies (pnpm install)...',
      ),
    );
    // --prefer-offline: with node_modules already hardlink-cloned, install just
    // reconciles against the lockfile and shouldn't need to hit the network.
    execFileSync('pnpm', ['install', ...(seeded ? ['--prefer-offline'] : [])], {
      cwd: wtPath,
      stdio: 'inherit',
    });
  }

  if (cfg.buildCommand) {
    console.log(chalk.bold(`==> Running build: ${cfg.buildCommand}`));
    execFileSync('sh', ['-c', cfg.buildCommand], { cwd: wtPath, stdio: 'inherit' });
  }

  // Write per-repo files with the allocated ports substituted in. Used
  // by platform to seed apps/*/.env.local so the running dev server
  // picks up the right ports without extra env-var plumbing.
  if (cfg.writeFiles?.length) {
    console.log(chalk.bold('==> Writing worktree-scoped files'));
    for (const { contents, path } of cfg.writeFiles) {
      let interpolated = contents;
      for (const [svcName, port] of Object.entries(entry.ports)) {
        interpolated = interpolated
          .replaceAll(`{${svcName}_port}`, String(port))
          .replaceAll('{port}', String(port));
      }
      const fullPath = resolve(wtPath, path);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, interpolated);
      console.log(`  wrote ${path}`);
    }
  }

  // Inherit non-port env vars from the main worktree's files. Runs after
  // writeFiles so port keys written by the CLI stay authoritative — only
  // missing keys are appended.
  if (cfg.inheritEnvFromMain?.length) {
    console.log(chalk.bold('==> Inheriting non-port env vars from main worktree'));
    for (const relPath of cfg.inheritEnvFromMain) {
      const mainFile = resolve(repoRoot, relPath);
      const wtFile = resolve(wtPath, relPath);

      if (!existsSync(mainFile)) {
        console.log(chalk.dim(`  skip ${relPath} (not present in main worktree)`));
        continue;
      }

      const mainContents = readFileSync(mainFile, 'utf-8');
      const wtContents = existsSync(wtFile) ? readFileSync(wtFile, 'utf-8') : '';
      const appended = buildInheritedAppend(mainContents, wtContents);

      if (appended.length === 0) {
        console.log(chalk.dim(`  skip ${relPath} (no missing keys to inherit)`));
        continue;
      }

      mkdirSync(dirname(wtFile), { recursive: true });
      if (existsSync(wtFile)) {
        appendFileSync(wtFile, appended);
      } else {
        writeFileSync(wtFile, appended.replace(/^\n/, ''));
      }
      const inheritedCount = appended.split('\n').filter((l) => /^[A-Za-z_]/.test(l)).length;
      console.log(`  inherited ${inheritedCount} key(s) into ${relPath}`);
    }
  }

  console.log('');
  console.log(chalk.green(`Worktree ready: ${wtPath}`));
  console.log(`  Branch: ${branch}`);
  for (const svc of cfg.services) {
    const port = entry.ports[svc.name]!;
    console.log(
      `  ${svc.name.padEnd(8)}: http://localhost:${port}  (logs: ${logFile(svc, branch)})`,
    );
  }
  console.log('');
  console.log('To start the dev server(s):');
  console.log(`  cd ${wtPath} && precisa-worktree dev ${branch}`);
}

/**
 * Hardlink-clones the main worktree's `node_modules` into the new worktree
 * before install. `cp -al` shares the same inodes (near-instant, copies no
 * bytes) — the same model pnpm itself uses when linking from the global store,
 * so `pnpm install` afterward only reconciles the diff against the lockfile,
 * which is close to a no-op when the branch hasn't touched deps (the common
 * case). pnpm writes via atomic replace, so it never corrupts the main
 * worktree's `node_modules` through a shared inode. `cp -a` preserves pnpm's
 * relative symlinks as symlinks, so they resolve within the new worktree.
 *
 * Best-effort: any failure (no source, cp unavailable) returns false and the
 * caller falls back to a normal install. Skips if the target already exists.
 */
export function seedNodeModules(repoRoot: string, wtPath: string): boolean {
  const src = resolve(repoRoot, 'node_modules');
  const dst = resolve(wtPath, 'node_modules');
  if (!existsSync(src) || existsSync(dst)) return false;
  try {
    execFileSync('cp', ['-al', src, dst], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function branchExists(repoRoot: string, branch: string): boolean {
  const local = spawnSync(
    'git',
    ['-C', repoRoot, 'show-ref', '--verify', '--quiet', `refs/heads/${branch}`],
    { stdio: 'ignore' },
  );
  if (local.status === 0) return true;
  const remote = spawnSync(
    'git',
    ['-C', repoRoot, 'show-ref', '--verify', '--quiet', `refs/remotes/origin/${branch}`],
    { stdio: 'ignore' },
  );
  return remote.status === 0;
}
