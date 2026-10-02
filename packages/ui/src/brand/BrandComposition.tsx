import { type ReactNode, useEffect, useId, useMemo, useRef } from 'react';

import { animateComposition } from './animate.js';
import {
  BRAND,
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
  type CompositionMode,
  DEFAULT_VIEW_BOX_X,
  generateComposition,
  mainBounds,
  mainPath,
} from './geometry.js';
import { Grain } from './Grain.js';
import { Shape } from './Shape.js';
import { clamp, edgeOffset, lineDrift } from './timeline.js';

export interface BrandCompositionProps {
  anchor?: 'bottom' | 'top';
  /** Desativa todo o movimento, inclusive o parallax. */
  animated?: boolean;
  bleed?: boolean;
  /** Conteúdo SVG em primeiro plano, fora do espelhamento das formas. */
  children?: ReactNode;
  className?: string;
  fit?: 'meet' | 'slice';
  /** Sem rótulo, o SVG é decorativo e fica fora da árvore acessível. */
  label?: string;
  mirror?: boolean;
  mode?: CompositionMode;
  /** Intensidade do parallax; zero conserva apenas entradas e saídas. */
  parallax?: number;
  seed?: number;
  /** Opacidade do grão estático nos planos grandes, entre 0 e 1. */
  texture?: number;
  viewBoxX?: number;
}

/** Composição compartilhada: geometria, sequência reversível e textura, sem assets privados. */
export function BrandComposition({
  anchor = 'bottom',
  animated = true,
  bleed = true,
  children,
  className,
  fit = 'meet',
  label,
  mirror = false,
  mode = 'reference',
  parallax = 1,
  seed = 1,
  texture = 0.16,
  viewBoxX = DEFAULT_VIEW_BOX_X,
}: BrandCompositionProps) {
  const ref = useRef<SVGSVGElement>(null);
  const uid = useId().replace(/:/g, '');
  const grain = `brand-grain-${uid}`;
  const hatch = `brand-hatch-${uid}`;
  const c = useMemo(() => generateComposition(seed, mode), [seed, mode]);
  const box = mainBounds(c.main);
  const edge = (x: number, width: number) => edgeOffset(x, width, viewBoxX, COMPOSITION_WIDTH);
  const top = bleed ? -2000 : 0;
  const grainOpacity = clamp(texture);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    if (!animated) {
      svg.querySelectorAll('[data-brand-motion]').forEach((node) => {
        node.removeAttribute('transform');
        node.removeAttribute('opacity');
      });
      return;
    }
    return animateComposition(svg, parallax);
  }, [animated, parallax, seed, mode, viewBoxX, bleed]);

  const main =
    c.main.kind === 'circle' ? (
      <circle cx={c.main.cx} cy={c.main.cy} r={c.main.r} />
    ) : (
      <path d={mainPath(c.main)} />
    );
  const dark = c.dark && (
    <rect height={c.dark.height - top} width={COMPOSITION_WIDTH * 2} x={c.dark.x} y={top} />
  );
  const strip = c.strip && (
    <rect height={c.strip.height - top} width={c.strip.width} x={c.strip.x} y={top} />
  );
  const surface = (shape: ReactNode, fill: string) => (
    <>
      <g fill={fill}>{shape}</g>
      {grainOpacity > 0 && (
        <g fill={`url(#${grain})`} opacity={grainOpacity}>
          {shape}
        </g>
      )}
    </>
  );
  const chain = c.chain;
  const chainFromRight = chain ? chain.x1 - viewBoxX > COMPOSITION_WIDTH - chain.x2 : false;

  return (
    <svg
      ref={ref}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={className}
      focusable="false"
      overflow="visible"
      preserveAspectRatio={`${mirror ? 'xMin' : 'xMax'}${anchor === 'top' ? 'YMin' : 'YMax'} ${fit}`}
      role={label ? 'img' : undefined}
      viewBox={`${viewBoxX} 0 ${COMPOSITION_WIDTH - viewBoxX} ${COMPOSITION_HEIGHT}`}
    >
      <defs>
        {grainOpacity > 0 && <Grain id={grain} seed={seed} />}
        <pattern
          height="4"
          id={hatch}
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
          width="4"
        >
          <rect fill={BRAND.lavenderSoft} height="4" width="4" />
          <line stroke={BRAND.violet} strokeOpacity=".45" strokeWidth="1.5" x1="0" x2="0" y2="4" />
        </pattern>
      </defs>
      <g
        transform={mirror ? `translate(${viewBoxX + COMPOSITION_WIDTH} 0) scale(-1 1)` : undefined}
      >
        <Shape
          motion={{ cx: c.ring.cx, cy: c.ring.cy, delay: 0, depth: -55, duration: 0.8, grow: true }}
        >
          <circle
            cx={c.ring.cx}
            cy={c.ring.cy}
            fill="none"
            r={c.ring.r}
            stroke={BRAND[c.ring.stroke]}
            strokeOpacity={c.ring.stroke === 'violet' ? 0.6 : 1}
            strokeWidth="2"
          />
        </Shape>
        <Shape
          motion={{
            cx: (box.x1 + box.x2) / 2,
            cy: (box.y1 + box.y2) / 2,
            delay: 0.08,
            depth: 60,
            duration: 0.7,
            grow: c.main.kind === 'circle',
            x: c.main.kind === 'circle' ? 0 : edge(box.x1, box.x2 - box.x1),
          }}
        >
          {surface(main, BRAND[c.main.fill])}
        </Shape>
        {c.strip && (
          <Shape motion={{ delay: 0.2, depth: 95, duration: 0.65, y: -(c.strip.height + 40) }}>
            {surface(strip, BRAND[c.strip.color === 'mint' ? 'mint' : 'lavenderSoft'])}
          </Shape>
        )}
        {c.dark && (
          <Shape motion={{ delay: 0.14, depth: 95, duration: 0.7, y: -(c.dark.height + 40) }}>
            {surface(dark, BRAND.violet)}
          </Shape>
        )}
        {c.rails.map((rail, i) => (
          <Shape
            key={`rail-${i}`}
            motion={{
              delay: 0.2 + i * 0.035,
              depth: 130 + i * 3,
              drift: lineDrift(i),
              duration: 0.65,
              x: edge(rail.x1, rail.x2 - rail.x1),
            }}
          >
            <line
              stroke={BRAND.lavender}
              strokeOpacity=".35"
              strokeWidth="1"
              x1={rail.x1}
              x2={rail.x2}
              y1={rail.y}
              y2={rail.y}
            />
          </Shape>
        ))}
        {c.fragments.map((f, i) => (
          <Shape
            key={`fragment-${i}`}
            motion={{
              delay: 0.24 + i * 0.012,
              depth: 130 + (i % 7) * 5,
              drift: lineDrift(i),
              duration: 0.65,
              x: edge(f.x, f.width),
            }}
          >
            <rect
              fill={
                f.fill === 'hatch'
                  ? `url(#${hatch})`
                  : BRAND[f.fill === 'lavender' ? 'lavenderSoft' : f.fill]
              }
              height={f.height}
              width={f.width}
              x={f.x}
              y={f.y - f.height / 2}
            />
          </Shape>
        ))}
        {chain && (
          <>
            <Shape
              motion={{
                delay: 0.3,
                depth: 85,
                drift: 20,
                duration: 0.7,
                x: edge(chain.x1, chain.x2 - chain.x1),
              }}
            >
              <line
                stroke={BRAND.violet}
                strokeDasharray="2 5"
                strokeOpacity=".6"
                strokeWidth="1.5"
                x1={chain.x1}
                x2={chain.x2}
                y1={chain.y}
                y2={chain.y}
              />
            </Shape>
            {chain.items.map((item, i) => (
              <Shape
                key={`chain-${i}`}
                motion={{
                  cx: item.x,
                  cy: chain.y,
                  delay: 0.4 + (chainFromRight ? chain.items.length - 1 - i : i) * 0.045,
                  depth: 85,
                  drift: 20,
                  duration: 0.22,
                  grow: item.kind !== 'square',
                  x: item.kind === 'square' ? edge(item.x, item.size) : 0,
                }}
              >
                {item.kind === 'square' ? (
                  <rect
                    fill={BRAND[item.color === 'lavender' ? 'lavenderSoft' : item.color]}
                    height={item.size}
                    width={item.size}
                    x={item.x}
                    y={chain.y - item.size / 2}
                  />
                ) : (
                  <circle
                    cx={item.x}
                    cy={chain.y}
                    fill={item.kind === 'dot' ? BRAND.lavender : 'none'}
                    r={item.r}
                    stroke={item.kind === 'ring' ? BRAND.violet : undefined}
                    strokeWidth="2"
                  />
                )}
              </Shape>
            ))}
          </>
        )}
        {c.dots &&
          Array.from({ length: c.dots.cols * c.dots.rows }, (_, i) => {
            const dots = c.dots!;
            const cx = dots.x + (i % dots.cols) * dots.step;
            const cy = dots.y + Math.floor(i / dots.cols) * dots.step;
            return (
              <Shape
                key={`dot-${i}`}
                motion={{ cx, cy, delay: 0.32 + i * 0.018, depth: 160, duration: 0.12, grow: true }}
              >
                <circle cx={cx} cy={cy} fill={BRAND.violet} r="2.2" />
              </Shape>
            );
          })}
        {c.coral && (
          <Shape
            motion={{
              cx: c.coral.cx,
              cy: c.coral.cy,
              delay: 0.7,
              depth: 145,
              duration: 0.3,
              grow: true,
            }}
          >
            <circle cx={c.coral.cx} cy={c.coral.cy} fill={BRAND.coral} r={c.coral.r} />
          </Shape>
        )}
      </g>
      {children}
    </svg>
  );
}
