import chalk from 'chalk';

import { applyTemplate } from '../lib/merge.js';
import { loadTemplateManifest, readTemplateSource, renderTokens } from '../lib/templates.js';
import { isIgnored, isRequired, loadManifest, tokenContext } from '../manifest.js';

export interface ScaffoldOptions {
  dryRun: boolean;
  only: string[];
}

/** Adiciona apenas os alvos solicitados; arquivos existentes pertencem ao repo. */
export async function runScaffold(opts: ScaffoldOptions): Promise<void> {
  const cwd = process.cwd();
  const manifest = loadManifest(cwd);
  const templates = loadTemplateManifest();
  const targets = [...new Set(opts.only)];
  const entries = targets.map((target) => {
    const entry = templates.find((candidate) => candidate.target === target);
    if (!entry || !isRequired(entry.required_when, manifest)) {
      throw new Error(`Template indisponível para este perfil: ${target}`);
    }
    if (isIgnored(target, manifest)) {
      throw new Error(`Alvo excluído por ignoreTemplates: ${target}`);
    }
    return entry;
  });
  const context = tokenContext(manifest);
  for (const entry of entries) {
    const outcome = applyTemplate({
      cwd,
      dryRun: opts.dryRun,
      entry: { ...entry, merge_strategy: 'skip_if_exists' },
      rendered: renderTokens(readTemplateSource(entry), context),
    });
    console.log(`${opts.dryRun ? '[simulação] ' : ''}${outcome.kind}: ${entry.target}`);
    if (outcome.kind === 'error') throw new Error(outcome.message);
  }
  console.log(chalk.dim('Arquivos existentes foram preservados.'));
}
