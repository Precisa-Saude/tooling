/**
 * Integration test for the inheritEnvFromMain path of setup. Spawns a
 * real `git worktree add` in a temp repo and verifies env files end up
 * with both the writeFiles port keys and the inherited dev creds.
 *
 * Network-free and deterministic — works against a tmpdir, no pnpm
 * install (set `install: false`).
 */
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { setup } from '../dist/index.js';

// Re-export setup so the integration test can drive it. We rely on the
// CLI exporting it from `index.ts`; if it's not exported, the test
// imports below would throw — keeping the surface explicit.

describe('setup with inheritEnvFromMain', () => {
  it('appends non-port keys from main worktree into the new worktree', async () => {
    const root = mkdtempSync(join(tmpdir(), 'wt-cli-it-'));
    try {
      // Bootstrap a minimal git repo to act as the "main worktree".
      execFileSync('git', ['init', '-q', '--initial-branch=main', root]);
      execFileSync('git', ['-C', root, 'config', 'user.email', 'test@local']);
      execFileSync('git', ['-C', root, 'config', 'user.name', 'test']);
      execFileSync('git', ['-C', root, 'config', 'commit.gpgsign', 'false']);
      writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'fixture' }));
      // Main worktree's .env.local with two creds keys.
      writeFileSync(
        join(root, '.env.local'),
        '# main worktree creds\nCOGNITO_POOL=abc\nSTRIPE_KEY=sk_test_xxx\n',
      );
      execFileSync('git', ['-C', root, 'add', '.']);
      execFileSync('git', ['-C', root, 'commit', '-q', '-m', 'init']);
      // Fake a remote named "origin" pointing at ourselves so the
      // `git fetch origin main` step in setup doesn't fail.
      execFileSync('git', ['-C', root, 'remote', 'add', 'origin', root]);
      execFileSync('git', ['-C', root, 'fetch', '-q', 'origin', 'main']);

      const portRegistry = join(root, 'ports.json');
      writeFileSync(portRegistry, JSON.stringify({}));

      const cfg = {
        directoryPrefix: 'fixture',
        install: false, // skip pnpm install in the test
        portRegistry,
        services: [
          {
            featureBase: 4010,
            logPrefix: 'fixture-api',
            mainPort: 4000,
            name: 'api',
            pnpmFilter: 'fixture',
          },
        ],
        writeFiles: [
          // Port key written by the CLI — must NOT be overridden by the
          // inherit step even if main also has a PORT entry.
          { path: '.env.local', contents: 'PORT={api_port}\n' },
        ],
        inheritEnvFromMain: ['.env.local'],
      };

      await setup({ branch: 'feat/it-test', cfg, repoRoot: root });

      const wtPath = join(root, '..', 'fixture-feat-it-test');
      const wtEnv = readFileSync(join(wtPath, '.env.local'), 'utf-8');

      // Port from writeFiles preserved.
      assert.match(wtEnv, /^PORT=4010$/m);
      // Creds from main inherited.
      assert.match(wtEnv, /COGNITO_POOL=abc/);
      assert.match(wtEnv, /STRIPE_KEY=sk_test_xxx/);
      // Header present so it's clear how the keys got there.
      assert.match(wtEnv, /# Inherited from main worktree/);

      // Cleanup the linked worktree before nuking root.
      execFileSync('git', ['-C', root, 'worktree', 'remove', '--force', wtPath]);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});
