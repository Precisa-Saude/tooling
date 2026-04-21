#!/usr/bin/env node
/**
 * Syncs the root package.json version to every non-private workspace package.
 * Invoked by semantic-release via `@semantic-release/exec` during `prepare`,
 * after the root version has already been bumped.
 *
 * Discovers packages automatically so adding a new `packages/<name>` doesn't
 * require editing this script. Packages marked `"private": true` are skipped
 * (they don't publish).
 */

const { readdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const PACKAGES_DIR = 'packages';

const rootPkg = JSON.parse(readFileSync('package.json', 'utf-8'));
const version = rootPkg.version;

if (!version) {
  console.error('No version found in root package.json');
  process.exit(1);
}

const entries = readdirSync(PACKAGES_DIR, { withFileTypes: true }).filter((e) => e.isDirectory());

let synced = 0;
let skipped = 0;

for (const entry of entries) {
  const pkgJsonPath = join(PACKAGES_DIR, entry.name, 'package.json');

  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
  } catch (err) {
    console.warn(`Skipped ${entry.name}: no package.json (${err.message})`);
    continue;
  }

  if (pkg.private) {
    console.log(`Skipped ${pkg.name} (private)`);
    skipped += 1;
    continue;
  }

  pkg.version = version;
  writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`${pkg.name}@${version}`);
  synced += 1;
}

console.log(
  `\nSynced ${synced} package${synced === 1 ? '' : 's'} to v${version}, skipped ${skipped} private.`,
);
