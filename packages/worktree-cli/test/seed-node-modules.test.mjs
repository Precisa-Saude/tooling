/**
 * Unit test for seedNodeModules: the hardlink-clone of the main worktree's
 * node_modules into a new one. Verifies it shares inodes (a real hardlink, not
 * a byte copy), preserves symlinks as symlinks, and is a safe no-op when the
 * target already exists or the source is missing.
 *
 * Network-free, no pnpm — just a fake node_modules in a tmpdir.
 */
import { strict as assert } from 'node:assert';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
  lstatSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { seedNodeModules } from '../dist/index.js';

describe('seedNodeModules', () => {
  it('hardlink-clones node_modules from main, sharing inodes and keeping symlinks', () => {
    const base = mkdtempSync(join(tmpdir(), 'wt-seed-'));
    try {
      const main = join(base, 'main');
      const wt = join(base, 'wt');
      mkdirSync(join(main, 'node_modules', 'pkg'), { recursive: true });
      mkdirSync(wt, { recursive: true });
      const realFile = join(main, 'node_modules', 'pkg', 'index.js');
      writeFileSync(realFile, 'module.exports = 1;');
      // pnpm fills node_modules with relative symlinks; make sure they survive.
      symlinkSync('./pkg/index.js', join(main, 'node_modules', 'link.js'));

      const seeded = seedNodeModules(main, wt);
      assert.equal(seeded, true);

      const clonedFile = join(wt, 'node_modules', 'pkg', 'index.js');
      assert.ok(existsSync(clonedFile), 'cloned file exists');
      // Same inode = true hardlink, no byte copy.
      assert.equal(statSync(realFile).ino, statSync(clonedFile).ino, 'shares inode');
      // Symlink stays a symlink, not a dereferenced copy.
      assert.ok(
        lstatSync(join(wt, 'node_modules', 'link.js')).isSymbolicLink(),
        'symlink preserved',
      );
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it('is a no-op when the target node_modules already exists', () => {
    const base = mkdtempSync(join(tmpdir(), 'wt-seed-'));
    try {
      const main = join(base, 'main');
      const wt = join(base, 'wt');
      mkdirSync(join(main, 'node_modules'), { recursive: true });
      mkdirSync(join(wt, 'node_modules'), { recursive: true }); // already there
      assert.equal(seedNodeModules(main, wt), false);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it('returns false when main has no node_modules', () => {
    const base = mkdtempSync(join(tmpdir(), 'wt-seed-'));
    try {
      const main = join(base, 'main');
      const wt = join(base, 'wt');
      mkdirSync(main, { recursive: true });
      mkdirSync(wt, { recursive: true });
      assert.equal(seedNodeModules(main, wt), false);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
