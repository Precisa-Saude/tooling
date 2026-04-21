import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    'cards/index': 'src/cards/index.ts',
    'charts/index': 'src/charts/index.ts',
    'decorative/index': 'src/decorative/index.ts',
    'hooks/index': 'src/hooks/index.ts',
    index: 'src/index.ts',
    'layout/index': 'src/layout/index.ts',
    'marketing/index': 'src/marketing/index.ts',
    'navigation/index': 'src/navigation/index.ts',
    'primitives/index': 'src/primitives/index.ts',
    'utils/index': 'src/utils/index.ts',
  },
  external: ['react', 'react-dom', '@base-ui/react', 'lucide-react', 'recharts', 'shiki'],
  format: ['esm'],
  platform: 'browser',
  sourcemap: true,
  splitting: false,
  target: 'es2022',
});
