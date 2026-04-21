import chalk from 'chalk';

export interface NewOptions {
  dryRun: boolean;
  profile: string;
}

export async function runNew(repoName: string, opts: NewOptions): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(chalk.bold.cyan(`\nprecisa new ${repoName}`));
  // eslint-disable-next-line no-console
  console.log(chalk.dim(`profile: ${opts.profile}, dry-run: ${opts.dryRun}`));
  // eslint-disable-next-line no-console
  console.log(
    chalk.yellow(
      '\n[stub] Scaffolding is not implemented yet. Planned behavior:\n' +
        '  1. Prompt for visibility, site/package/npm flags, scopes, contact emails\n' +
        '  2. Create target directory and write .precisa.json\n' +
        '  3. Render templates/ against the manifest (workflows, husky, docs)\n' +
        '  4. Wire @precisa-saude/{eslint,prettier,tsconfig,commitlint}-config deps\n' +
        '  5. Run git init, pnpm install, husky install\n',
    ),
  );
  process.exit(0);
}
