import { spawn } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';

import chalk from 'chalk';

import { devArgs, type ServiceConfig, type WorktreeConfig } from '../config.js';
import { logFile, worktreePath } from '../paths.js';
import { isPortInUse, killPort } from '../ports.js';
import { getBranchEntry, portFor } from '../registry.js';

export interface DevOptions {
  branch: string;
  cfg: WorktreeConfig;
  /** Run detached from the terminal; write stdout/stderr to log files. */
  detach?: boolean;
  /** If a port is already in use, kill the process instead of aborting. */
  force?: boolean;
  repoRoot: string;
}

export async function dev({
  branch,
  cfg,
  detach = false,
  force = false,
  repoRoot,
}: DevOptions): Promise<void> {
  const entry = await getBranchEntry(cfg, branch);
  if (!entry) {
    console.error(chalk.red(`No ports allocated for '${branch}'. Run setup first.`));
    process.exit(1);
  }

  const wtPath = worktreePath(cfg, repoRoot, branch);
  if (!existsSync(wtPath)) {
    console.error(chalk.red(`Worktree not found at ${wtPath}`));
    process.exit(1);
  }

  for (const svc of cfg.services) {
    const port = portFor(entry, svc);
    if (isPortInUse(port)) {
      if (force) {
        console.log(chalk.yellow(`Port ${port} in use — killing (--force)`));
        await killPort(port);
      } else {
        console.error(
          chalk.red(`Port ${port} (${svc.name}) already in use. Pass --force to kill.`),
        );
        process.exit(1);
      }
    }
  }

  console.log(chalk.bold(`Starting dev servers for '${branch}'...`));
  for (const svc of cfg.services) {
    const port = portFor(entry, svc);
    console.log(`  ${svc.name}: http://localhost:${port}  (logs: ${logFile(svc, branch)})`);
  }
  console.log('');

  const procs = cfg.services.map((svc) => spawnService(svc, entry, wtPath, branch, detach));

  if (detach) {
    for (const p of procs) p.unref();
    console.log(chalk.green('Started detached. Use `precisa-worktree stop` to kill.'));
    return;
  }

  // Foreground: forward signals, wait for first exit.
  const cleanup = (signal: NodeJS.Signals): void => {
    for (const p of procs) {
      try {
        if (!p.killed) p.kill(signal);
      } catch {
        // already dead
      }
    }
  };
  process.on('SIGINT', () => cleanup('SIGINT'));
  process.on('SIGTERM', () => cleanup('SIGTERM'));

  const exitCode = await new Promise<number>((resolvePromise) => {
    let resolved = false;
    for (const p of procs) {
      p.on('exit', (code) => {
        if (resolved) return;
        resolved = true;
        cleanup('SIGTERM');
        resolvePromise(code ?? 1);
      });
    }
  });
  process.exit(exitCode);
}

function spawnService(
  svc: ServiceConfig,
  entry: { ports: Record<string, number> },
  cwd: string,
  branch: string,
  detach: boolean,
): ReturnType<typeof spawn> {
  const port = portFor(entry, svc);
  const interpolate = (s: string): string => {
    let out = s.replace('{port}', String(port));
    // Allow cross-service refs like `{api_port}` so one service's env
    // can embed another service's allocated port.
    for (const [otherName, otherPort] of Object.entries(entry.ports)) {
      out = out.replaceAll(`{${otherName}_port}`, String(otherPort));
    }
    return out;
  };

  const rawArgs = devArgs(svc);
  // No `--` separator: with pnpm 9 + `"dev": "vite"`, inserting `--`
  // causes vite to receive it as a literal argv entry (`vite -- --port NNN`)
  // and silently ignore the port flag, falling back to its default.
  const args = ['--filter', svc.pnpmFilter, 'dev', ...rawArgs.map(interpolate)];

  const env = { ...process.env };
  for (const [k, v] of Object.entries(svc.env ?? {})) {
    env[k] = interpolate(v);
  }

  if (detach) {
    const logPath = logFile(svc, branch);
    const out = createWriteStream(logPath, { flags: 'a' });
    const proc = spawn('pnpm', args, {
      cwd,
      detached: true,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.stdout?.pipe(out);
    proc.stderr?.pipe(out);
    return proc;
  }

  return spawn('pnpm', args, { cwd, env, stdio: 'inherit' });
}
