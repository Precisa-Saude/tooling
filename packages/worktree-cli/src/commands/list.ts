import { existsSync } from 'node:fs';

import { type ServiceConfig, type WorktreeConfig } from '../config.js';
import { worktreePath } from '../paths.js';
import { isPortInUse } from '../ports.js';
import { readRegistry } from '../registry.js';

export interface ListOptions {
  cfg: WorktreeConfig;
  repoRoot: string;
}

export async function list({ cfg, repoRoot }: ListOptions): Promise<void> {
  const reg = await readRegistry(cfg);

  console.log(`Worktrees for ${cfg.directoryPrefix}:`);
  console.log('');

  const headers = ['BRANCH', ...cfg.services.map((s) => s.name.toUpperCase()), 'STATUS'];
  const widths = [40, ...cfg.services.map(() => 10), 10];
  printRow(headers, widths);
  printRow(
    headers.map((h) => '-'.repeat(Math.min(h.length, 6))),
    widths,
  );

  // Main worktree row
  printRow(
    [
      'main (default)',
      ...cfg.services.map((s) => String(s.mainPort)),
      statusOf(cfg.services, (s) => s.mainPort, /* dirExists */ true),
    ],
    widths,
  );

  // Feature worktree rows
  for (const [branch, entry] of Object.entries(reg)) {
    const wtPath = worktreePath(cfg, repoRoot, branch);
    const dirExists = existsSync(wtPath);
    const ports = cfg.services.map((s) => entry.ports[s.name]!);
    printRow(
      [
        branch,
        ...ports.map((p) => String(p)),
        dirExists ? statusOf(cfg.services, (s) => entry.ports[s.name]!, true) : 'missing',
      ],
      widths,
    );
  }

  console.log('');
  console.log(`Registry: ${cfg.portRegistry}`);
}

function statusOf(
  services: ServiceConfig[],
  portOf: (s: ServiceConfig) => number,
  dirExists: boolean,
): string {
  if (!dirExists) return 'missing';
  const anyRunning = services.some((s) => isPortInUse(portOf(s)));
  return anyRunning ? 'running' : 'stopped';
}

function printRow(cells: string[], widths: number[]): void {
  const line = cells.map((c, i) => c.padEnd(widths[i] ?? 10)).join(' ');
  console.log(`  ${line}`);
}
