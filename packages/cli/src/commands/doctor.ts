import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import chalk from 'chalk';

import {
  loadTemplateManifest,
  readTemplateSource,
  renderTokens,
  type TemplateEntry,
} from '../lib/templates.js';
import { isRequired, loadManifest, tokenContext } from '../manifest.js';

type Severity = 'ok' | 'info' | 'warning' | 'error';

interface DriftReport {
  message: string;
  severity: Severity;
  target: string;
}

export async function runDoctor(): Promise<void> {
  const cwd = process.cwd();
  console.log(chalk.bold.cyan('\nprecisa doctor'));

  let manifest;
  try {
    manifest = loadManifest(cwd);
  } catch (err) {
    console.error(chalk.red(`\n${(err as Error).message}`));
    process.exit(1);
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

  if (errors > 0) process.exit(1);
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
