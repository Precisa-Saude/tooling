/* eslint-disable no-console -- CLI de teardown: imprime progresso no console de propósito */
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

import chalk from 'chalk';

import { type WorktreeConfig } from '../config.js';
import { logFile, worktreePath } from '../paths.js';
import { isPortInUse, killPort } from '../ports.js';
import { free, getBranchEntry, portFor } from '../registry.js';

export interface TeardownOptions {
  branch: string;
  cfg: WorktreeConfig;
  keepBranch?: boolean;
  repoRoot: string;
}

export async function teardown({
  branch,
  cfg,
  keepBranch = false,
  repoRoot,
}: TeardownOptions): Promise<void> {
  const entry = await getBranchEntry(cfg, branch);
  const wtPath = worktreePath(cfg, repoRoot, branch);

  if (entry) await stopServices(cfg, entry);

  if (existsSync(wtPath)) {
    console.log(chalk.bold(`Removing worktree: ${wtPath}`));
    execFileSync('git', ['-C', repoRoot, 'worktree', 'remove', wtPath, '--force'], {
      stdio: 'inherit',
    });
  }

  if (keepBranch) {
    console.log(`Preserving local branch: ${branch}`);
  } else {
    const branchExists = branchRefExists(repoRoot, branch);
    if (branchExists) {
      console.log(chalk.bold(`Deleting local branch: ${branch}`));
      try {
        execFileSync('git', ['-C', repoRoot, 'branch', '-d', branch], {
          stdio: 'ignore',
        });
      } catch {
        // Not fully merged — force-delete since worktree was already removed.
        execFileSync('git', ['-C', repoRoot, 'branch', '-D', branch], {
          stdio: 'inherit',
        });
      }
    }
  }

  await releaseBranchResources(cfg, branch);

  console.log(chalk.green(`Teardown complete for '${branch}'.`));
}

/** Kill the dev servers listening on the ports allocated to a branch. */
export async function stopServices(
  cfg: WorktreeConfig,
  entry: { ports: Record<string, number> },
): Promise<void> {
  for (const svc of cfg.services) {
    const port = portFor(entry, svc);
    if (isPortInUse(port)) {
      console.log(chalk.bold(`Stopping ${svc.name} dev server on port ${port}...`));
      await killPort(port);
    }
  }
}

/** Free the branch's registry slot and delete its log files. */
export async function releaseBranchResources(cfg: WorktreeConfig, branch: string): Promise<void> {
  await free(cfg, branch);

  for (const svc of cfg.services) {
    const path = logFile(svc, branch);
    if (existsSync(path)) rmSync(path);
  }
}

function branchRefExists(repoRoot: string, branch: string): boolean {
  try {
    execFileSync(
      'git',
      ['-C', repoRoot, 'show-ref', '--verify', '--quiet', `refs/heads/${branch}`],
      {
        stdio: 'ignore',
      },
    );
    return true;
  } catch {
    return false;
  }
}
