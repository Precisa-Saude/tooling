/**
 * Helpers for inheriting non-port env vars from the main worktree's
 * `.env.local` files into a new worktree. See `WorktreeConfig.inheritEnvFromMain`.
 *
 * Intentionally pure: I/O happens in the caller (setup command). Keeping
 * the parsing/merge logic free of fs calls makes it trivial to unit-test
 * and reusable from `dev` if we ever want to re-sync mid-session.
 */

/**
 * Extract just the keys defined in a KEY=VALUE-style env file. Lines that
 * start with `#` (after optional whitespace) and blank lines are skipped.
 * Quoted values and inline `#` comments are not stripped — we only care
 * about the key position. Repeated keys collapse to a single entry (set).
 */
export function parseEnvKeys(contents: string): Set<string> {
  const keys = new Set<string>();
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trimStart();
    if (line.length === 0 || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    // KEY format must look like an env var name. Skip noise (typos,
    // markdown table rows, anything with whitespace or non-identifier
    // chars on the left of `=`).
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    keys.add(key);
  }
  return keys;
}

/**
 * Given the contents of the main worktree's env file and the worktree's
 * own env file (possibly empty), return the lines to append. Returns
 * `''` (no trailing newline, no header) when nothing needs to be appended
 * so the caller can decide whether to touch the file at all.
 *
 * Key-by-key inheritance, not file replacement — the worktree-CLI's
 * port-specific lines (e.g. `PORT=3010`, `VITE_API_URL=http://localhost:3010/api`)
 * stay authoritative.
 */
export function buildInheritedAppend(
  mainContents: string,
  worktreeContents: string,
  options: { header?: string } = {},
): string {
  const existingKeys = parseEnvKeys(worktreeContents);

  const linesToAppend: string[] = [];
  for (const rawLine of mainContents.split('\n')) {
    const line = rawLine.trimStart();
    if (line.length === 0 || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (existingKeys.has(key)) continue;
    linesToAppend.push(rawLine);
    existingKeys.add(key); // dedupe within the source file too
  }

  if (linesToAppend.length === 0) return '';

  const header = options.header ?? '# Inherited from main worktree by precisa-worktree setup';
  // Ensure separation from whatever the worktree already had — a leading
  // blank line, then the header, then the inherited lines, then trailing
  // newline.
  const prefix = worktreeContents.length > 0 && !worktreeContents.endsWith('\n') ? '\n' : '';
  return `${prefix}\n${header}\n${linesToAppend.join('\n')}\n`;
}
