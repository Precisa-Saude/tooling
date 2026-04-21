import type { CSSProperties, ReactNode } from 'react';

import { cn } from '../utils/cn.js';

export interface MarqueeProps {
  children: ReactNode;
  className?: string;
  /** Scroll direction. Default: `left`. */
  direction?: 'left' | 'right';
  /** Animation duration in seconds. Default: `300`. Lower = faster scroll. */
  duration?: number;
}

/**
 * Horizontally-scrolling marquee with seamless loop and edge fade masks.
 *
 * Children are rendered twice so the animation has no visible seam. The
 * container's CSS mask fades the left/right edges for a softer entry /
 * exit. Animation duration is exposed via `--marquee-duration`; the
 * matching keyframes (`animate-marquee-left` / `-right`) ship in
 * `@precisa-saude/themes/animations.css`.
 *
 * Honors `prefers-reduced-motion` via the themes CSS (animation becomes
 * `none` when the user has reduced-motion set).
 */
export function Marquee({ children, className, direction = 'left', duration = 300 }: MarqueeProps) {
  const animationClass = direction === 'left' ? 'animate-marquee-left' : 'animate-marquee-right';

  return (
    <div
      data-slot="marquee"
      className={cn('overflow-hidden', className)}
      style={{
        maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)',
      }}
    >
      <div
        className={cn('flex w-max', animationClass)}
        style={{ '--marquee-duration': `${duration}s` } as CSSProperties}
      >
        <div className="flex shrink-0">{children}</div>
        <div aria-hidden className="flex shrink-0">
          {children}
        </div>
      </div>
    </div>
  );
}
