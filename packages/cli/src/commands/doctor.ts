import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import chalk from 'chalk';

import {
  loadTemplateManifest,
  readTemplateSource,
  renderTokens,
  type TemplateEntry,
} from '../lib/templates.js';
import { isIgnored, isRequired, loadManifest, tokenContext } from '../manifest.js';

type Severity = 'ok' | 'info' | 'warning' | 'error';

interface DriftReport {
  message: string;
  severity: Severity;
  target: string;
}

/**
 * Exit codes — consumidos pelo workflow `doctor.yml`, que reporta cada caso de
 * um jeito diferente. Colapsá-los foi o que fez o audit mensal virar ruído:
 * "não consegui auditar" e "encontrei drift" eram o mesmo não-zero.
 */
export const DOCTOR_EXIT = {
  /** Sem drift acionável. */
  CLEAN: 0,
  /** Drift encontrado — o doctor rodou e comparou. */
  DRIFT: 1,
  /** `.precisa.json` ausente ou inválido — nada foi comparado. */
  INVALID_MANIFEST: 2,
} as const;

export async function runDoctor(): Promise<void> {
  const cwd = process.cwd();
  console.log(chalk.bold.cyan('\nprecisa doctor'));

  let manifest;
  try {
    manifest = loadManifest(cwd);
  } catch (err) {
    console.error(chalk.red(`\n${(err as Error).message}`));
    // Código próprio: manifesto inválido não é drift. Reportá-lo como drift
    // manda o mantenedor rodar `sync`, que não resolve nada aqui.
    process.exit(DOCTOR_EXIT.INVALID_MANIFEST);
  }

  const entries = loadTemplateManifest();
  const context = tokenContext(manifest);

  const reports: DriftReport[] = [];

  for (const entry of entries) {
    const required = isRequired(entry.required_when, manifest);
    const targetPath = resolve(cwd, entry.target);
    const exists = existsSync(targetPath);

    if (!required && !exists) continue;
    if (!required && exists) {
      reports.push({
        message: `Present but not required by the manifest profile (ok)`,
        severity: 'info',
        target: entry.target,
      });
      continue;
    }
    if (!exists) {
      reports.push({
        message: 'Missing',
        severity: 'error',
        target: entry.target,
      });
      continue;
    }

    // Divergência declarada em `ignoreTemplates`: informativa, nunca warning.
    // Sem isso o repo receberia o mesmo alerta todo mês por uma customização
    // que ele escolheu manter, e o sinal perderia credibilidade.
    if (isIgnored(entry.target, manifest)) {
      reports.push({
        message: 'Divergência deliberada (ignoreTemplates) — sync não toca',
        severity: 'info',
        target: entry.target,
      });
      continue;
    }

    // Exists + required — compare to rendered template
    const source = readTemplateSource(entry);
    const rendered = renderTokens(source, context);
    const current = readFileSync(targetPath, 'utf-8');
    reports.push(compareContent(entry, current, rendered));
  }

  console.log('');
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  let oks = 0;

  for (const r of reports) {
    const icon = iconFor(r.severity);
    const line = `${icon} ${r.target}${r.message ? chalk.dim(` — ${r.message}`) : ''}`;
    console.log(line);
    if (r.severity === 'error') errors += 1;
    else if (r.severity === 'warning') warnings += 1;
    else if (r.severity === 'info') infos += 1;
    else oks += 1;
  }

  console.log('');
  console.log(chalk.dim(`${oks} ok, ${warnings} warning, ${errors} error, ${infos} info`));

  // Sai não-zero em QUALQUER drift acionável, não só em arquivo ausente.
  //
  // `warning` significa "sync reescreveria este arquivo" — ou seja, divergência
  // real do template canônico. Sair 0 nesse caso tornava o audit mensal
  // estruturalmente incapaz de reportar a única coisa que ele existe para
  // reportar: um repo com o `ci.yml` reescrito à mão passava verde.
  //
  // `info` continua não-fatal de propósito: são os arquivos cuja divergência é
  // intencional (estratégias `preserve` e `skip_if_exists`, onde o sync não
  // sobrescreve). Falhar neles transformaria o audit em ruído permanente.
  if (errors > 0 || warnings > 0) process.exit(DOCTOR_EXIT.DRIFT);
}

function compareContent(entry: TemplateEntry, current: string, rendered: string): DriftReport {
  if (current === rendered) {
    return { message: '', severity: 'ok', target: entry.target };
  }

  // Non-overwrite strategies don't re-render on sync — treat drift as
  // informational, not a warning. Makes the doctor output scannable:
  // warnings are the files sync WOULD change; infos are files where
  // drift is intentional (customized scaffold, preserved docs).
  if (entry.merge_strategy === 'preserve') {
    return {
      message: 'Differs from template (preserve strategy — suggestion only)',
      severity: 'info',
      target: entry.target,
    };
  }
  if (entry.merge_strategy === 'skip_if_exists') {
    return {
      message: 'Differs from template (scaffold-only; sync will not overwrite)',
      severity: 'info',
      target: entry.target,
    };
  }

  return {
    message: 'Differs from template (run `precisa sync` to update)',
    severity: 'warning',
    target: entry.target,
  };
}

function iconFor(severity: Severity): string {
  switch (severity) {
    case 'ok':
      return chalk.green('✓');
    case 'info':
      return chalk.blue('i');
    case 'warning':
      return chalk.yellow('!');
    case 'error':
      return chalk.red('✗');
  }
}
