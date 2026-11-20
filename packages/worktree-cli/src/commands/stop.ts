/* eslint-disable no-console -- CLI de stop: imprime progresso no console de propósito */
import chalk from 'chalk';

import { hasServices, noServicesMessage, type WorktreeConfig } from '../config.js';
import { isPortInUse, killPort } from '../ports.js';
import { getBranchEntry, portFor } from '../registry.js';

export interface StopOptions {
  branch: string;
  cfg: WorktreeConfig;
}

export async function stop({ branch, cfg }: StopOptions): Promise<void> {
  if (!hasServices(cfg)) {
    console.log(noServicesMessage(cfg, 'stop'));
    return;
  }

  const entry = await getBranchEntry(cfg, branch);
  if (!entry) {
    console.error(`No ports registered for '${branch}'.`);
    process.exit(1);
  }

  let anyRunning = false;
  for (const svc of cfg.services) {
    const port = portFor(entry, svc);
    if (isPortInUse(port)) {
      console.log(chalk.bold(`Killing ${svc.name} dev server on port ${port}...`));
      await killPort(port);
      anyRunning = true;
    }
  }

  if (!anyRunning) {
    console.log(`No dev servers running for '${branch}'.`);
  }
}
