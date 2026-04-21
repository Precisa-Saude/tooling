#!/usr/bin/env node
import { Command } from 'commander';

import { runDoctor } from './commands/doctor.js';
import { runNew } from './commands/new.js';
import { runSync } from './commands/sync.js';

const program = new Command();

program
  .name('precisa')
  .description('Bootstrap and sync Precisa Saúde repositories.')
  .version('0.0.0');

program
  .command('new <repo-name>')
  .description('Scaffold a new repository from the shared templates.')
  .option('--profile <profile>', 'preset: oss-library | oss-site | private-app', 'oss-library')
  .option('--dry-run', 'print what would be written without touching disk', false)
  .action(async (repoName: string, opts: { profile: string; dryRun: boolean }) => {
    await runNew(repoName, opts);
  });

program
  .command('sync')
  .description("Re-render templates against this repo's .precisa.json manifest.")
  .option('--dry-run', 'print a diff without writing', false)
  .action(async (opts: { dryRun: boolean }) => {
    await runSync(opts);
  });

program
  .command('doctor')
  .description('Audit this repo against the templates and report drift.')
  .action(async () => {
    await runDoctor();
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
