import { type ComponentProps, useEffect, useRef } from 'react';

export interface ParticleSettings {
  /** CSS color for particles. Default: `var(--primary)` resolved at runtime, else `#8e8bd8`. */
  color?: string;
  /** Base particle lifespan in ms. Default: `1500`. */
  lifespan?: number;
  /** Max radius in px. Default: `3`. */
  maxRadius?: number;
  /** Max particle velocity (px / frame). Default: `2`. */
  maxVelocity?: number;
  /** Number of particles emitted per second. Default: `30`. */
  rate?: number;
}

export interface ParticleCanvasProps extends Omit<ComponentProps<'canvas'>, 'children' | 'ref'> {
  /** Render height. Default: `400`. */
  height?: number;
  /** Pause the animation (and stop emitting). */
  paused?: boolean;
  /** Particle appearance / density. */
  settings?: ParticleSettings;
  /** Render width. Default: `400`. */
  width?: number;
}

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
};

/**
 * Ambient particle-animation canvas. Emits colored particles from the
 * center outward with linear motion and fade-out.
 *
 * Honors `prefers-reduced-motion` by rendering a single static frame.
 *
 * Independent of any charting library. Useful as a background flourish
 * or as a decorative accent behind a chart.
 */
export function ParticleCanvas({
  height = 400,
  paused = false,
  settings,
  style,
  width = 400,
  ...props
}: ParticleCanvasProps) {
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

    const rate = settings?.rate ?? 30;
    const lifespan = settings?.lifespan ?? 1500;
    const maxRadius = settings?.maxRadius ?? 3;
    const maxVelocity = settings?.maxVelocity ?? 2;
    const colorProp = settings?.color;

    let resolvedColor = '#8e8bd8';
    if (typeof window !== 'undefined') {
      const fromVar = colorProp?.startsWith('var(')
        ? getComputedStyle(document.documentElement).getPropertyValue(colorProp.slice(4, -1)).trim()
        : undefined;
      resolvedColor = fromVar || colorProp || 'var(--primary)';
      if (resolvedColor.startsWith('var(')) {
        resolvedColor =
          getComputedStyle(document.documentElement)
            .getPropertyValue(resolvedColor.slice(4, -1))
            .trim() || '#8e8bd8';
      }
    }

    const particles: Particle[] = [];
    let raf = 0;
    let lastEmit = performance.now();

    function emit(now: number) {
      const emissionInterval = 1000 / rate;
      while (now - lastEmit > emissionInterval) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * maxVelocity;
        particles.push({
          life: lifespan,
          maxLife: lifespan,
          radius: Math.random() * maxRadius + 0.5,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          x: width / 2,
          y: height / 2,
        });
        lastEmit += emissionInterval;
      }
    }

    function tick(now: number) {
      ctx!.clearRect(0, 0, width, height);
      if (!paused) emit(now);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 16;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx!.globalAlpha = alpha;
        ctx!.fillStyle = resolvedColor;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
      if (!prefersReduced && !paused) raf = requestAnimationFrame(tick);
    }

    if (prefersReduced || paused) {
      // one static frame for reference
      tick(performance.now());
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
      data-slot="particle-canvas"
      style={{ height, width, ...style }}
      aria-hidden
      {...props}
    />
  );
}
