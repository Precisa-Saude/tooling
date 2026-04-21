import type { ComponentProps, ElementType, ReactNode } from 'react';

import { cn } from '../utils/cn.js';

export interface PageContainerProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Wrapped element. Defaults to `<div>`. Use `<main>`, `<section>`, etc. for semantics. */
  as?: ElementType;
  children?: ReactNode;
}

/**
 * Top-level page wrapper that applies the shared 14/16-col responsive
 * grid with `max-w-(--grid-max-w)` and horizontal gutters.
 *
 * Requires the CSS variables from `@precisa-saude/themes/grid.css`
 * (`--grid-cols`, `--grid-max-w`). Children use arbitrary Tailwind grid
 * utilities or the `useGridCol()` hook to place themselves within the
 * grid.
 *
 * @example
 *   <PageContainer as="main" className="py-16">
 *     <h1 style={useGridCol()(3, 10)}>Welcome</h1>
 *   </PageContainer>
 */
export function PageContainer({
  as: Component = 'div',
  children,
  className,
  ...props
}: PageContainerProps) {
  return (
    <Component
      data-slot="page-container"
      className={cn(
        'mx-auto grid w-full gap-4 px-4 md:px-0',
        'grid-cols-[repeat(var(--grid-cols),1fr)]',
        'max-w-(--grid-max-w)',
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
