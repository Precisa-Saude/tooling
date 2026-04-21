# @precisa-saude/ui

Shared React components, hooks, and utilities for Precisa Saúde sites and apps.

Built on [Base UI](https://base-ui.com) (shadcn `base-nova` style) for headless primitives. Uses the tokens from [`@precisa-saude/themes`](../themes) for styling; consumers should import that package's CSS first.

## Status

**In early development.** Current surface:

- `utils/cn()` — Tailwind class merger (clsx + tailwind-merge)
- `hooks/useMediaQuery` — SSR-safe matchMedia subscription
- `hooks/useWideGrid` / `useDesktop` — viewport breakpoints aligned with `@precisa-saude/themes/grid.css`
- `hooks/useGridCol` — inline-style builder for the 14/16-col grid
- `hooks/useReducedMotion` — `prefers-reduced-motion` subscription
- `decorative/CornerSquares` — two-square corner accents on the responsive grid
- `decorative/DuotoneFilter` — SVG filter for duotone image treatments (dark shadows → light highlights, configurable)
- `decorative/GridOverlay` — dev-mode fixed overlay that visualizes the 14/16-col grid (press `g` to cycle)
- `decorative/MosaicBg` — canvas-based animated mosaic background with OKLCh color interpolation
- `primitives/Button` — Base UI button with CVA variants (default/outline/secondary/ghost/destructive/link × xs/sm/default/lg/icon sizes)
- `primitives/Badge` — pill label with CVA variants (default/secondary/destructive/outline + success/warning/elevated/critical/info semantic variants)
- `primitives/Tooltip` — Base UI tooltip (Provider/Root/Trigger/Content sub-components + convenience `Tooltip` wrapper)
- `primitives/Select` — Base UI select with full sub-component set (Trigger/Content/Item/Label/Separator/Group/Value/ScrollUp/ScrollDown)
- `primitives/Dialog` — Base UI dialog with built-in backdrop + close button (Root/Trigger/Portal/Backdrop/Content/Header/Footer/Title/Description/Close)
- `primitives/Tabs` — Base UI tabs (Root/List/Trigger/Panel/Indicator)
- `primitives/Accordion` — Base UI accordion with chevron that rotates on open (Root/Item/Header/Trigger/Panel)
- `primitives/Popover` — Base UI popover (Root/Trigger/Portal/Content/Close)
- `primitives/Switch` — Base UI toggle switch
- `primitives/Checkbox` — Base UI checkbox with determinate + indeterminate states
- `primitives/Field` — Base UI form field (Root/Label/Control/Description/Error/Validity)

More primitives (Menu, Toast), layout components (Header, Footer, MobileDrawer, PageContainer), navigation (Breadcrumbs, SlidingTabs), cards (ActionCard, NewsCard), marketing sections (Hero, FeatureGrid, StatsGrid, CodeExample), and chart theming wrappers land in follow-up releases.

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

| Path                           | Contents                                                                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `@precisa-saude/ui`            | Everything (re-exports from all sub-paths)                                                                                                    |
| `@precisa-saude/ui/utils`      | `cn`                                                                                                                                          |
| `@precisa-saude/ui/hooks`      | `useMediaQuery`, `useWideGrid`, `useDesktop`, `useGridCol`, `useReducedMotion`                                                                |
| `@precisa-saude/ui/decorative` | `CornerSquares`, `DuotoneFilter`, `GridOverlay`, `MosaicBg`                                                                                   |
| `@precisa-saude/ui/primitives` | `Button`, `Badge`, `Tooltip`, `Select`, `Dialog`, `Tabs`, `Accordion`, `Popover`, `Switch`, `Checkbox`, `Field` (+ sub-components / variants) |

Tree-shakable: bundle only what you import.

## License

Apache-2.0
