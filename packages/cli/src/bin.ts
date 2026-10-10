#!/usr/bin/env node
import { Command } from 'commander';

import { runDoctor } from './commands/doctor.js';
import { runNew } from './commands/new.js';
import { runScaffold } from './commands/scaffold.js';
import { runSync } from './commands/sync.js';
import { CLI_VERSION } from './lib/baseline.js';

const program = new Command();

program
  .name('precisa')
  .description('Cria repositórios e verifica os requisitos da Precisa Saúde.')
  .version(CLI_VERSION);

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
  .command('scaffold')
  .description('Adiciona templates selecionados sem sobrescrever arquivos existentes.')
  .requiredOption('--only <targets...>', 'caminhos dos arquivos a adicionar')
  .option('--dry-run', 'simula a criação sem escrever', false)
  .action(runScaffold);

program
  .command('sync')
  .description('Descontinuado. Use Renovate para atualizar e scaffold para adicionar arquivos.')
  .option('--dry-run', 'print a diff without writing', false)
  .action(async (opts: { dryRun: boolean }) => {
    await runSync(opts);
  });

program
  .command('doctor')
  .description('Verifica manifestos, comandos e integração dos checks no CI.')
  .action(async () => {
    await runDoctor();
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
