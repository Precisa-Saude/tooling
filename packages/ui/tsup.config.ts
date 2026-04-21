import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    'hooks/index': 'src/hooks/index.ts',
    index: 'src/index.ts',
    'utils/index': 'src/utils/index.ts',
  },
  external: ['react', 'react-dom'],
  format: ['esm'],
  platform: 'browser',
  sourcemap: true,
  splitting: false,
  target: 'es2022',
});
