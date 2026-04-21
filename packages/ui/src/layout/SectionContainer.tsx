import type { ComponentProps, ElementType, ReactNode } from 'react';

import { cn } from '../utils/cn.js';

export interface SectionContainerProps extends Omit<ComponentProps<'section'>, 'children'> {
  /** Wrapped element. Defaults to `<section>`. */
  as?: ElementType;
  children?: ReactNode;
  /** Vertical padding scale. Default: `lg`. */
  spacing?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

const spacingClasses: Record<NonNullable<SectionContainerProps['spacing']>, string> = {
  lg: 'py-16 md:py-20',
  md: 'py-12',
  none: '',
  sm: 'py-8',
  xl: 'py-20 md:py-28',
};

/**
 * Section wrapper with standard vertical padding + the shared 14/16-col
 * grid. Use directly inside a `PageContainer` or standalone for
 * full-width sections (e.g. with a decorative background).
 *
 * Requires the CSS variables from `@precisa-saude/themes/grid.css`.
 */
export function SectionContainer({
  as: Component = 'section',
  children,
  className,
  spacing = 'lg',
  ...props
}: SectionContainerProps) {
  return (
    <Component
      data-slot="section-container"
      className={cn(
        'relative mx-auto grid w-full gap-4 px-4 md:px-0',
        'grid-cols-[repeat(var(--grid-cols),1fr)]',
        'max-w-(--grid-max-w)',
        spacingClasses[spacing],
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
