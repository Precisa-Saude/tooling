import chalk from 'chalk';
import { createPatch } from 'diff';

/**
 * Format a unified diff with ANSI colors for terminal display.
 * Skips the `@@ hunk @@` metadata lines for a cleaner look.
 */
export function colorDiff(filename: string, previous: string, next: string): string {
  const patch = createPatch(filename, previous, next, '', '');
  const lines = patch.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    if (line.startsWith('---') || line.startsWith('+++')) continue;
    if (line.startsWith('@@')) {
      out.push(chalk.cyan(line));
      continue;
    }
    if (line.startsWith('+')) {
      out.push(chalk.green(line));
      continue;
    }
    if (line.startsWith('-')) {
      out.push(chalk.red(line));
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}
