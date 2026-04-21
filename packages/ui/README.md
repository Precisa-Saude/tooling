# @precisa-saude/ui

Shared React components, hooks, and utilities for Precisa Saúde sites and apps.

Built on [Base UI](https://base-ui.com) (shadcn `base-nova` style) for headless primitives. Uses the tokens from [`@precisa-saude/themes`](../themes) for styling; consumers should import that package's CSS first.

## Status

**In early development.** Current surface (v0):

- `utils/cn()` — Tailwind class merger (clsx + tailwind-merge)
- `hooks/useMediaQuery` — SSR-safe matchMedia subscription
- `hooks/useWideGrid` / `useDesktop` — viewport breakpoints aligned with `@precisa-saude/themes/grid.css`
- `hooks/useGridCol` — inline-style builder for the 14/16-col grid
- `hooks/useReducedMotion` — `prefers-reduced-motion` subscription

Primitives (Button, Select, Dialog, Tooltip, …), layout components (Header, Footer, MobileDrawer, PageContainer), navigation (Breadcrumbs, SlidingTabs), cards (ActionCard, NewsCard), marketing sections (Hero, FeatureGrid, StatsGrid, CodeExample), decorative (GridOverlay, MosaicBg, CornerSquares, DuotoneFilter), and chart theming wrappers land in follow-up releases.

## Install

```bash
pnpm add @precisa-saude/ui @precisa-saude/themes
```

Peer dependencies: `react@^19`, `react-dom@^19`.

## Use

### Utilities

```tsx
import { cn } from '@precisa-saude/ui/utils';

<div className={cn('px-4 py-2', isActive && 'bg-primary')} />;
```

### Hooks

```tsx
import { useGridCol, useMediaQuery, useReducedMotion, useWideGrid } from '@precisa-saude/ui/hooks';

function Hero() {
  const col = useGridCol();
  const reduced = useReducedMotion();

  return (
    <section className="grid grid-cols-[repeat(var(--grid-cols),1fr)] gap-4">
      <h1 style={col(3, 10)}>Welcome</h1>
      {!reduced && <video autoPlay loop muted src="/hero.webm" />}
    </section>
  );
}
```

### Convenience root import

```tsx
import { cn, useWideGrid } from '@precisa-saude/ui';
```

## Sub-path exports

| Path                      | Contents                                                                       |
| ------------------------- | ------------------------------------------------------------------------------ |
| `@precisa-saude/ui`       | Everything (utils + hooks — and as components land, those too)                 |
| `@precisa-saude/ui/utils` | `cn`                                                                           |
| `@precisa-saude/ui/hooks` | `useMediaQuery`, `useWideGrid`, `useDesktop`, `useGridCol`, `useReducedMotion` |

Tree-shakable: bundle only what you import.

## License

Apache-2.0
