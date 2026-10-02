import type { ReactNode } from 'react';

import type { ShapeMotion } from './timeline.js';

/** O estado estático é completo, inclusive em SSR e sem JavaScript. */
export function Shape({ children, motion }: { children: ReactNode; motion: ShapeMotion }) {
  return <g data-brand-motion={JSON.stringify(motion)}>{children}</g>;
}
