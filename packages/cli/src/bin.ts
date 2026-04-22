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
  .option('--non-interactive', 'skip prompts; use --owner/--scopes/etc. flags instead', false)
  .option('--owner <org>', 'GitHub owner (org or user)', 'Precisa-Saude')
  .option(
    '--scopes <csv>',
    'Comma-separated commit scopes (e.g. "core,docs,ci,deps")',
    'docs,ci,deps',
  )
  .option('--security-email <email>', 'Security contact email', 'security@precisa-saude.com.br')
  .option(
    '--conduct-email <email>',
    'Code-of-conduct contact email',
    'conduct@precisa-saude.com.br',
  )
  .action(
    async (
      repoName: string,
      opts: {
        profile: string;
        dryRun: boolean;
        nonInteractive: boolean;
        owner: string;
        scopes: string;
        securityEmail: string;
        conductEmail: string;
      },
    ) => {
      await runNew(repoName, opts);
    },
  );

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
  console.error(err);
  process.exit(1);
});
