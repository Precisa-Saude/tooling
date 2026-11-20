/* eslint-disable no-console -- CLI de teardown: imprime progresso no console de propósito */
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

import chalk from 'chalk';

import { hasServices, type WorktreeConfig } from '../config.js';
import { logFile, parseWorktreeList, type WorktreeEntry } from '../paths.js';
import { isPortInUse, killPort } from '../ports.js';
import { free, getBranchEntry, portFor } from '../registry.js';
import { hasUncommittedChanges, run } from './prune-stale.js';

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
  // Sem serviços não há portas: o registro não é lido nem criado.
  const entry = hasServices(cfg) ? await getBranchEntry(cfg, branch) : null;
  // O caminho vem do git e não da convenção `<prefixo>-<branch>`: worktrees
  // criados com `git worktree add` podem estar em qualquer diretório.
  const worktree = branchWorktree(repoRoot, branch);

  // Verificado antes de qualquer efeito, porque o `--force` abaixo
  // descartaria o trabalho não commitado.
  if (worktree && !worktree.prunable) assertClean(worktree.path);

  if (entry) await stopServices(cfg, entry);

  if (worktree) {
    console.log(chalk.bold(`Removing worktree: ${worktree.path}`));
    // Também remove o registro de um worktree cujo diretório já sumiu, que
    // impediria o `git branch -D` logo abaixo.
    execFileSync('git', ['-C', repoRoot, 'worktree', 'remove', worktree.path, '--force'], {
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

  if (hasServices(cfg)) await releaseBranchResources(cfg, branch);

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

/** Worktree vinculado com `branch` em checkout, fora o checkout principal. */
function branchWorktree(repoRoot: string, branch: string): WorktreeEntry | undefined {
  const porcelain = run('git', ['-C', repoRoot, 'worktree', 'list', '--porcelain']);
  return parseWorktreeList(porcelain)
    .slice(1)
    .find((wt) => wt.branch === branch);
}

function assertClean(path: string): void {
  if (!hasUncommittedChanges(run('git', ['-C', path, 'status', '--porcelain']))) return;
  throw new Error(
    `Worktree ${path} has uncommitted changes; nothing was removed. ` +
      'Commit or discard them, then run teardown again.',
  );
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
