import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import chalk from 'chalk';

import { type WorktreeConfig } from '../config.js';
import { logFile } from '../paths.js';

export interface LogsOptions {
  branch: string;
  cfg: WorktreeConfig;
  service?: string;
}

export async function logs({ branch, cfg, service }: LogsOptions): Promise<void> {
  const svc = service ? cfg.services.find((s) => s.name === service) : cfg.services[0];

  if (!svc) {
    const names = cfg.services.map((s) => s.name).join(', ');
    console.error(chalk.red(`Unknown service "${service}". Valid services: ${names}`));
    process.exit(1);
  }

  const path = logFile(svc, branch);
  if (!existsSync(path)) {
    console.error(chalk.red(`Log file not found: ${path}`));
    console.error(`Start the dev server first: precisa-worktree dev ${branch}`);
    process.exit(1);
  }

  // Delegate to tail -f so Ctrl-C works and rotation is handled.
  const result = spawnSync('tail', ['-f', path], { stdio: 'inherit' });
  process.exit(result.status ?? 0);
}
