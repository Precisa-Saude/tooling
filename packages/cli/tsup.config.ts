import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
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
