# @precisa-saude/themes

Shared CSS design tokens for Precisa Saúde repositories. Ships OKLCh color palettes, a responsive 14/16-column grid, typography scaffolding, status semantics, and shared animations — all as CSS custom properties.

No JavaScript. No bundler needed. Works with Tailwind v3, Tailwind v4, vanilla CSS, or anything that honors `@import`.

## Install

```bash
pnpm add @precisa-saude/themes
```

## Use

**Everything at once** (recommended for most sites):

```css
/* your-app/src/index.css */
@import 'tailwindcss';
@import '@precisa-saude/themes';
```

**Cherry-pick modules**:

```css
@import '@precisa-saude/themes/base.css'; /* typography scaffolding + spacing + shadows */
@import '@precisa-saude/themes/colors.css'; /* palette + shadcn semantic tokens */
@import '@precisa-saude/themes/grid.css'; /* 14/16-col responsive grid */
@import '@precisa-saude/themes/status.css'; /* success/warning/elevated/critical/info */
@import '@precisa-saude/themes/animations.css'; /* marquee + reduced-motion */
```

## What's inside

### `base.css`

- `--font-sans`, `--font-serif`, `--font-mono` — default fallback chains (system UI fonts). Override on `:root` to inject custom fonts.
- `--spacing`, `--radius`, `--tracking-*` — spacing unit, border radius, letter-spacing scale
- `--shadow-*` — shadow ramp (2xs → 2xl), light + dark variants

### `colors.css`

- **Brand palette**: `--ps-violet`, `--ps-mint`, `--ps-amber`, `--ps-green` (plus dark variants)
- **Surface**: `--background`, `--foreground`, `--card`, `--popover`
- **Semantic**: `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive` (each with `-foreground`)
- **Borders / focus**: `--border`, `--input`, `--ring`
- **Charts**: `--chart-1` through `--chart-5`
- **Sidebar**: `--sidebar`, `--sidebar-*` (for app shells with a sidebar)
- **Gradient**: `--gradient-from`, `--gradient-to` (defaults: primary → ps-mint)

All values in OKLCh. Dark mode triggers under `.dark` — add `class="dark"` on `<html>` or use a theme toggle.

### `grid.css`

- 14 columns below 1440px, 16 columns above
- `--grid-cols`, `--grid-gaps`, `--grid-max-w`, `--col-w`
- Use with Tailwind's arbitrary-grid syntax: `grid grid-cols-[repeat(var(--grid-cols),1fr)] gap-4`

### `status.css`

Generic status palette (success / warning / elevated / critical / info). Each exposes a base color, foreground, and tint. Light + dark variants.

```css
.pill-success {
  background: var(--status-success-tint);
  color: var(--status-success);
}
```

### `animations.css`

- `.animate-marquee-left` / `.animate-marquee-right` — horizontal scroll keyframes
- `--marquee-duration` — override per element (default `300s`)
- Honors `prefers-reduced-motion`

## Custom fonts

The default `--font-sans` / `--font-serif` / `--font-mono` chains use system fonts so sites render without any extra setup. To swap in custom fonts:

```css
@import '@precisa-saude/themes';

@font-face {
  font-family: 'YourFont';
  src: url('/fonts/YourFont.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
}

:root {
  --font-sans: 'YourFont', system-ui, sans-serif;
}
```

## Dark mode

Toggle by adding `class="dark"` on `<html>` (or any parent element). All token values cascade automatically.

```ts
document.documentElement.classList.toggle('dark');
```

## Tailwind v4

The tokens are designed for Tailwind v4's `@theme` extraction. In your Tailwind config:

```css
@theme {
  --color-primary: var(--primary);
  --color-background: var(--background);
  /* ...or use @theme inline to map directly */
}
```

## License

Apache-2.0
