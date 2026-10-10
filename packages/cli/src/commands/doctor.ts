import chalk from 'chalk';

import { checkRequirements } from '../lib/requirements.js';
import { loadManifest } from '../manifest.js';

export const DOCTOR_EXIT = { CLEAN: 0, INVALID_MANIFEST: 2, REQUIREMENTS: 1 } as const;

export async function runDoctor(): Promise<void> {
  let manifest;
  try {
    manifest = loadManifest(process.cwd());
  } catch (error) {
    console.error(chalk.red((error as Error).message));
    process.exitCode = DOCTOR_EXIT.INVALID_MANIFEST;
    return;
  }
  const reports = checkRequirements(process.cwd(), manifest);
  for (const report of reports) {
    const icon = report.severity === 'error' ? chalk.red('✗') : chalk.green('✓');
    console.log(`${icon} ${report.target}: ${report.message}`);
  }
  const errors = reports.filter((report) => report.severity === 'error').length;
  console.log(`${errors} requisito(s) pendente(s). Lint, build e testes são executados pelo CI.`);
  process.exitCode = errors ? DOCTOR_EXIT.REQUIREMENTS : DOCTOR_EXIT.CLEAN;
}
