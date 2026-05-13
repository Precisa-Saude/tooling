import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { buildInheritedAppend, parseEnvKeys } from '../dist/index.js';

describe('parseEnvKeys', () => {
  it('extracts keys from KEY=VALUE lines', () => {
    const keys = parseEnvKeys('FOO=1\nBAR=hello\nBAZ=');
    assert.deepEqual([...keys].sort(), ['BAR', 'BAZ', 'FOO']);
  });

  it('skips comments and blank lines', () => {
    const keys = parseEnvKeys('# header\n\nFOO=1\n  # indented comment\nBAR=2\n');
    assert.deepEqual([...keys].sort(), ['BAR', 'FOO']);
  });

  it('skips lines without an equals sign', () => {
    const keys = parseEnvKeys('FOO=1\nnot an env line\nBAR=2');
    assert.deepEqual([...keys].sort(), ['BAR', 'FOO']);
  });

  it('rejects keys that do not look like env var names', () => {
    const keys = parseEnvKeys('FOO=1\n123BAD=2\nBAR-DASH=3\nspace key=4\nGOOD_KEY=5');
    assert.deepEqual([...keys].sort(), ['FOO', 'GOOD_KEY']);
  });

  it('deduplicates repeated keys', () => {
    const keys = parseEnvKeys('FOO=1\nFOO=2\nBAR=3');
    assert.deepEqual([...keys].sort(), ['BAR', 'FOO']);
  });
});

describe('buildInheritedAppend', () => {
  it('appends keys from main that are missing in the worktree file', () => {
    const main = 'COGNITO_POOL=abc\nSTRIPE_KEY=sk_test_xxx\nPORT=3000';
    const worktree = 'PORT=3010\n';
    const out = buildInheritedAppend(main, worktree);
    assert.match(out, /COGNITO_POOL=abc/);
    assert.match(out, /STRIPE_KEY=sk_test_xxx/);
    // PORT is already in the worktree file — don't overwrite.
    assert.doesNotMatch(out, /^PORT=/m);
  });

  it('returns empty string when worktree already has every key', () => {
    const main = 'FOO=1\nBAR=2\n';
    const worktree = 'FOO=already\nBAR=existing\n';
    assert.equal(buildInheritedAppend(main, worktree), '');
  });

  it('returns empty string when main has nothing inheritable', () => {
    assert.equal(buildInheritedAppend('# only comments\n\n', 'PORT=3010\n'), '');
  });

  it('includes the header line so the source of inheritance is traceable', () => {
    const out = buildInheritedAppend('FOO=1\n', '');
    assert.match(out, /# Inherited from main worktree/);
  });

  it('accepts a custom header', () => {
    const out = buildInheritedAppend('FOO=1\n', '', { header: '# Custom header' });
    assert.match(out, /# Custom header/);
    assert.doesNotMatch(out, /Inherited from main worktree/);
  });

  it('ensures separation when the worktree file did not end with a newline', () => {
    const out = buildInheritedAppend('FOO=1\n', 'PORT=3010');
    assert.ok(
      out.startsWith('\n\n#'),
      `expected leading double-newline, got ${JSON.stringify(out)}`,
    );
  });

  it('does not re-add a key that appears multiple times in main', () => {
    const main = 'FOO=1\nFOO=2\nBAR=3';
    const out = buildInheritedAppend(main, '');
    const fooLines = out.split('\n').filter((l) => l.startsWith('FOO='));
    assert.equal(fooLines.length, 1, 'FOO should be appended once even if duplicated in main');
    assert.match(out, /BAR=3/);
  });

  it('skips comment lines from main when copying', () => {
    const main = '# Cognito section\nCOGNITO_POOL=abc\n# Stripe section\nSTRIPE_KEY=xyz\n';
    const out = buildInheritedAppend(main, '');
    assert.match(out, /COGNITO_POOL=abc/);
    assert.match(out, /STRIPE_KEY=xyz/);
    assert.doesNotMatch(out, /# Cognito section/);
    assert.doesNotMatch(out, /# Stripe section/);
  });
});
