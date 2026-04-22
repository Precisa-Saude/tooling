import { existsSync, mkdirSync, rmdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

import { increment, lockDir, type ServiceConfig, type WorktreeConfig } from './config.js';

export type Registry = Record<string, { slot: number; ports: Record<string, number> }>;

async function ensureRegistry(cfg: WorktreeConfig): Promise<void> {
  if (!existsSync(cfg.portRegistry)) {
    await writeFile(cfg.portRegistry, '{}');
  }
}

/**
 * Acquire an exclusive lock via `mkdir` — POSIX-atomic, portable across
 * macOS/Linux, no dependency on `flock` (which isn't on macOS by default).
 * Used to serialize registry read-modify-write across concurrent sessions.
 */
async function acquireLock(cfg: WorktreeConfig): Promise<void> {
  const dir = lockDir(cfg);
  const maxTries = 100;
  for (let i = 0; i < maxTries; i++) {
    try {
      mkdirSync(dir);
      return;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    }
    await sleep(100);
  }
  throw new Error(
    `Timeout (~10s) waiting for lock at ${dir}. If no other session is ` +
      `running, remove it manually: rmdir ${dir}`,
  );
}

function releaseLock(cfg: WorktreeConfig): void {
  try {
    rmdirSync(lockDir(cfg));
  } catch {
    // ignore — already released or never held
  }
}

/**
 * Run `fn` while holding the registry lock. Always releases, even on throw.
 * The release is also safe against signal interruption because the lock
 * directory will be removed at process exit via the handler in bin.ts.
 */
export async function withLock<T>(cfg: WorktreeConfig, fn: () => Promise<T> | T): Promise<T> {
  await ensureRegistry(cfg);
  await acquireLock(cfg);
  try {
    return await fn();
  } finally {
    releaseLock(cfg);
  }
}

export async function readRegistry(cfg: WorktreeConfig): Promise<Registry> {
  await ensureRegistry(cfg);
  const text = await readFile(cfg.portRegistry, 'utf-8');
  try {
    return JSON.parse(text) as Registry;
  } catch {
    return {};
  }
}

async function writeRegistry(cfg: WorktreeConfig, reg: Registry): Promise<void> {
  await writeFile(cfg.portRegistry, `${JSON.stringify(reg, null, 2)}\n`);
}

/**
 * Allocate a slot+ports for `branch`. Idempotent: returns the existing
 * entry if the branch already has one. Reuses freed slots so slot numbers
 * don't grow unbounded over many create/teardown cycles.
 */
export async function allocate(
  cfg: WorktreeConfig,
  branch: string,
): Promise<{ slot: number; ports: Record<string, number> }> {
  return withLock(cfg, async () => {
    const reg = await readRegistry(cfg);
    if (reg[branch]) return reg[branch];

    const usedSlots = new Set(Object.values(reg).map((e) => e.slot));
    let slot = 1;
    while (usedSlots.has(slot)) slot++;

    const ports: Record<string, number> = {};
    for (const svc of cfg.services) {
      ports[svc.name] = svc.featureBase + (slot - 1) * increment(svc);
    }

    reg[branch] = { ports, slot };
    await writeRegistry(cfg, reg);
    return reg[branch];
  });
}

export async function free(cfg: WorktreeConfig, branch: string): Promise<void> {
  return withLock(cfg, async () => {
    const reg = await readRegistry(cfg);
    if (reg[branch]) {
      delete reg[branch];
      await writeRegistry(cfg, reg);
    }
  });
}

export async function getBranchEntry(
  cfg: WorktreeConfig,
  branch: string,
): Promise<{ slot: number; ports: Record<string, number> } | null> {
  const reg = await readRegistry(cfg);
  return reg[branch] ?? null;
}

export function portFor(entry: { ports: Record<string, number> }, svc: ServiceConfig): number {
  const port = entry.ports[svc.name];
  if (typeof port !== 'number') {
    throw new Error(
      `No port allocated for service "${svc.name}" on this branch. ` +
        `Registry entry may be from an older config version — run teardown + setup again.`,
    );
  }
  return port;
}
