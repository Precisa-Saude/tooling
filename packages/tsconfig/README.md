# @precisa-saude/tsconfig

Shared TypeScript configs for Precisa Saúde repositories.

## Install

```bash
pnpm add -D @precisa-saude/tsconfig typescript
```

## Use

### Library / Node backend

```json
{
  "extends": "@precisa-saude/tsconfig/base",
  "include": ["src"]
}
```

### Publishable library (emits .d.ts + source maps + composite builds)

```json
{
  "extends": "@precisa-saude/tsconfig/library",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

### React app

```json
{
  "extends": "@precisa-saude/tsconfig/react",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

## What each variant includes

|                                                                              | base | library | react |
| ---------------------------------------------------------------------------- | ---- | ------- | ----- |
| `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters` | ✓    | ✓       | ✓     |
| `target: ES2022`, `moduleResolution: bundler`                                | ✓    | ✓       | ✓     |
| `declaration`, `declarationMap`, `sourceMap`                                 |      | ✓       |       |
| `composite`, `incremental`                                                   |      | ✓       |       |
| `lib: DOM + DOM.Iterable`, `jsx: react-jsx`                                  |      |         | ✓     |

## License

Apache-2.0
