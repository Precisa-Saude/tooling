import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import chalk from 'chalk';

import { type WorktreeConfig } from '../config.js';
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

  // Fetch origin/main from the main worktree; the new worktree branches from it.
  execFileSync('git', ['-C', repoRoot, 'fetch', 'origin', 'main'], { stdio: 'inherit' });
  execFileSync('git', ['-C', repoRoot, 'worktree', 'add', '-b', branch, wtPath, 'origin/main'], {
    stdio: 'inherit',
  });

  const entry = await allocate(cfg, branch);

  if (cfg.install !== false) {
    console.log(chalk.bold('==> Installing dependencies (pnpm install)...'));
    execFileSync('pnpm', ['install'], { cwd: wtPath, stdio: 'inherit' });
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
