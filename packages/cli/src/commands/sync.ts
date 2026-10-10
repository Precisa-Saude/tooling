import chalk from 'chalk';

export interface SyncOptions {
  dryRun: boolean;
}

/** Mantém o comando antigo sem permitir reescritas em repositórios existentes. */
export async function runSync(_opts: SyncOptions): Promise<void> {
  console.log(chalk.yellow('precisa sync foi descontinuado; nenhum arquivo foi alterado.'));
  console.log('Atualize as dependências e os workflows pelas PRs do Renovate.');
  console.log('Para adicionar um arquivo ausente: precisa scaffold --only <caminho> --dry-run');
  console.log('Para verificar os requisitos do repositório: precisa doctor');
  process.exitCode = 1;
}
