import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  define: {
    'process.env.PRECISA_CLI_VERSION': JSON.stringify(
      JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version,
    ),
    'process.env.PRECISA_WORKFLOW_REF': JSON.stringify(
      execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    ),
  },
  dts: true,
  entry: {
    bin: 'src/bin.ts',
    index: 'src/index.ts',
  },
  format: ['esm'],
  platform: 'node',
  shims: false,
  sourcemap: true,
  splitting: false,
  target: 'node22',
});
