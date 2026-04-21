/**
 * Duotone SVG filter component.
 *
 * Renders an invisible `<svg>` containing a `<filter>` definition. Apply
 * to any element (typically an `<img>` or background image) via
 * `filter: url(#your-id)` once this component is mounted anywhere in the
 * tree. Each instance must have a unique `id` — multiple duotone looks
 * can coexist on the same page by rendering multiple filters.
 *
 * Desaturates the input to grayscale, then remaps tones from `shadows`
 * (dark end) to `highlights` (light end).
 *
 * Default palette:
 *   shadows:    dark purple  (≈ #0A0819)
 *   highlights: light lavender (≈ #C7BFE0)
 *
 * @example
 *   <DuotoneFilter id="hero-duotone" />
 *   <img src="/photo.jpg" style={{ filter: 'url(#hero-duotone)' }} />
 */

/** RGB components in the 0–1 range (SVG feFuncR/G/B tableValues). */
export interface DuotoneColor {
  b: number;
  g: number;
  r: number;
}

export interface DuotoneFilterProps {
  /** Color mapped to the light end of the tonal range (default: light lavender). */
  highlights?: DuotoneColor;
  /** Unique filter ID — referenced by consumers via `filter: url(#id)`. */
  id: string;
  /** Color mapped to the dark end of the tonal range (default: dark purple). */
  shadows?: DuotoneColor;
}

export const DEFAULT_DUOTONE: { shadows: DuotoneColor; highlights: DuotoneColor } = {
  highlights: { b: 0.88, g: 0.75, r: 0.78 },
  shadows: { b: 0.1, g: 0.03, r: 0.04 },
};

export function DuotoneFilter({
  highlights = DEFAULT_DUOTONE.highlights,
  id,
  shadows = DEFAULT_DUOTONE.shadows,
}: DuotoneFilterProps) {
  return (
    <svg aria-hidden="true" className="absolute size-0">
      <defs>
        <filter id={id}>
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer colorInterpolationFilters="sRGB">
            <feFuncR tableValues={`${shadows.r} ${highlights.r}`} type="table" />
            <feFuncG tableValues={`${shadows.g} ${highlights.g}`} type="table" />
            <feFuncB tableValues={`${shadows.b} ${highlights.b}`} type="table" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}
