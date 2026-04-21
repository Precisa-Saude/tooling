import chalk from 'chalk';

export async function runDoctor(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(chalk.bold.cyan('\nprecisa doctor'));
  // eslint-disable-next-line no-console
  console.log(
    chalk.yellow(
      '\n[stub] Doctor is not implemented yet. Planned behavior:\n' +
        '  1. Read .precisa.json from cwd\n' +
        '  2. Compare every expected template against its rendered form\n' +
        '  3. Report drift per file with severity:\n' +
        '       - error:   missing required file\n' +
        '       - warning: stale content (version mismatch, old template version)\n' +
        '       - info:    preservable files with suggestions\n' +
        '  4. Exit non-zero if any error-severity drift is found\n',
    ),
  );
  process.exit(0);
}
