import chalk from 'chalk';

export interface SyncOptions {
  dryRun: boolean;
}

export async function runSync(opts: SyncOptions): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(chalk.bold.cyan('\nprecisa sync'));
  // eslint-disable-next-line no-console
  console.log(chalk.dim(`dry-run: ${opts.dryRun}`));
  // eslint-disable-next-line no-console
  console.log(
    chalk.yellow(
      '\n[stub] Sync is not implemented yet. Planned behavior:\n' +
        '  1. Read .precisa.json from cwd (error if missing)\n' +
        '  2. Re-render every template the manifest requires\n' +
        '  3. Apply merge strategies per file:\n' +
        '       - overwrite: workflows, husky, editorconfig, nvmrc, renovate, CoC/Security/Support\n' +
        '       - merge-json: package.json (managed keys only)\n' +
        '       - preserve:   CLAUDE.md, README.md, CONTRIBUTING.md (emit diff as suggestion)\n' +
        '  4. With --dry-run, print a per-file status table (create/update/preserve/skip)\n' +
        '  5. Without --dry-run, prompt for confirmation before writing\n',
    ),
  );
  process.exit(0);
}
