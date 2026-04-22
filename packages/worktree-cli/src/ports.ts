import { execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

/**
 * Return PIDs listening on `port` using the first available tool.
 * Prefers lsof (macOS default), falls back to ss then fuser (Linux).
 * Returns empty array if none can inspect ports or nothing is listening.
 */
function listenersOnPort(port: number): number[] {
  for (const [cmd, parse] of probers) {
    if (!hasCommand(cmd)) continue;
    try {
      const out = execSync(probeCommand(cmd, port), { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
      return parse(out);
    } catch {
      // non-zero exit — no listeners found
      return [];
    }
  }
  console.error(`Warning: lsof/ss/fuser not available — can't inspect port ${port}`);
  return [];
}

type Prober = [cmd: string, parse: (output: string) => number[]];

const probers: Prober[] = [
  [
    'lsof',
    (out) =>
      out
        .split('\n')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n)),
  ],
  [
    'ss',
    (out) => {
      const pids: number[] = [];
      for (const line of out.split('\n')) {
        const matches = line.match(/pid=(\d+)/g) ?? [];
        for (const m of matches) pids.push(parseInt(m.slice(4), 10));
      }
      return pids;
    },
  ],
  [
    'fuser',
    (out) =>
      out
        .split(/\s+/)
        .map((s) => parseInt(s, 10))
        .filter((n) => !isNaN(n)),
  ],
];

function probeCommand(cmd: string, port: number): string {
  switch (cmd) {
    case 'lsof':
      return `lsof -iTCP:${port} -sTCP:LISTEN -t`;
    case 'ss':
      return `ss -tlnp | awk '$4 ~ /:${port}$/ {print}'`;
    case 'fuser':
      return `fuser -n tcp ${port} 2>/dev/null`;
    default:
      throw new Error(`Unsupported prober: ${cmd}`);
  }
}

function hasCommand(cmd: string): boolean {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function isPortInUse(port: number): boolean {
  return listenersOnPort(port).length > 0;
}

/** Kill processes listening on `port`. SIGTERM first, then SIGKILL if any survive. */
export async function killPort(port: number): Promise<void> {
  const pids = listenersOnPort(port);
  if (pids.length === 0) return;

  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // process may have exited between listing and kill — ignore
    }
  }

  await sleep(1000);

  const stillAlive = listenersOnPort(port);
  for (const pid of stillAlive) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // ignore
    }
  }
}
