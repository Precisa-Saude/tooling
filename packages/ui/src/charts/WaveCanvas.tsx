import { type ComponentProps, useEffect, useRef } from 'react';

export interface WaveSettings {
  /** Amplitude in px. Default: `20`. */
  amplitude?: number;
  /** Stroke color. Default: `var(--primary)` resolved at runtime. */
  color?: string;
  /** Number of concurrent waves (stacked with different phases). Default: `1`. */
  count?: number;
  /** Animation speed (phase increment per frame). Default: `0.03`. */
  speed?: number;
  /** Stroke width in px. Default: `2`. */
  strokeWidth?: number;
  /** Wavelength in px. Default: `120`. */
  wavelength?: number;
}

export interface WaveCanvasProps extends Omit<ComponentProps<'canvas'>, 'children' | 'ref'> {
  height?: number;
  paused?: boolean;
  settings?: WaveSettings;
  width?: number;
}

/**
 * Sine-wave canvas animation. Draws one or more stacked sine curves
 * that drift horizontally.
 *
 * Honors `prefers-reduced-motion` by rendering a single static frame.
 * Pure animation primitive — no business logic.
 */
export function WaveCanvas({
  height = 200,
  paused = false,
  settings,
  style,
  width = 400,
  ...props
}: WaveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const amplitude = settings?.amplitude ?? 20;
    const wavelength = settings?.wavelength ?? 120;
    const speed = settings?.speed ?? 0.03;
    const strokeWidth = settings?.strokeWidth ?? 2;
    const count = Math.max(1, settings?.count ?? 1);
    const colorProp = settings?.color;

    let resolvedColor = '#8e8bd8';
    if (typeof window !== 'undefined') {
      const raw = colorProp ?? 'var(--primary)';
      if (raw.startsWith('var(')) {
        resolvedColor =
          getComputedStyle(document.documentElement).getPropertyValue(raw.slice(4, -1)).trim() ||
          '#8e8bd8';
      } else {
        resolvedColor = raw;
      }
    }

    const centerY = height / 2;
    let phase = 0;
    let raf = 0;

    function drawFrame() {
      ctx!.clearRect(0, 0, width, height);
      ctx!.lineWidth = strokeWidth;
      for (let n = 0; n < count; n++) {
        ctx!.globalAlpha = 1 / count + 0.1 * (1 - n / count);
        ctx!.strokeStyle = resolvedColor;
        ctx!.beginPath();
        for (let x = 0; x <= width; x++) {
          const y =
            centerY +
            Math.sin((x / wavelength) * Math.PI * 2 + phase + n * 0.8) * amplitude * (1 - n * 0.12);
          if (x === 0) ctx!.moveTo(x, y);
          else ctx!.lineTo(x, y);
        }
        ctx!.stroke();
      }
      ctx!.globalAlpha = 1;
    }

    function tick() {
      if (!paused) phase += speed;
      drawFrame();
      if (!prefersReduced && !paused) raf = requestAnimationFrame(tick);
    }

    if (prefersReduced || paused) {
      drawFrame();
    } else {
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [width, height, paused, settings]);

  return (
    <canvas
      ref={canvasRef}
      data-slot="wave-canvas"
      style={{ height, width, ...style }}
      aria-hidden
      {...props}
    />
  );
}
