import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '../utils/cn.js';

export const badgeVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-1 rounded-full border px-2 py-0.5',
    'text-xs font-medium whitespace-nowrap transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
    "[&>svg]:pointer-events-none [&>svg]:shrink-0 [&>svg:not([class*='size-'])]:size-3",
  ].join(' '),
  {
    defaultVariants: {
      variant: 'default',
    },
    variants: {
      variant: {
        critical:
          'border-transparent bg-[var(--status-critical-tint)] text-[var(--status-critical)]',
        default: 'border-transparent bg-primary text-primary-foreground',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground dark:bg-destructive/80',
        elevated:
          'border-transparent bg-[var(--status-elevated-tint)] text-[var(--status-elevated)]',
        info: 'border-transparent bg-[var(--status-info-tint)] text-[var(--status-info)]',
        outline: 'border-border text-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        success: 'border-transparent bg-[var(--status-success-tint)] text-[var(--status-success)]',
        warning: 'border-transparent bg-[var(--status-warning-tint)] text-[var(--status-warning)]',
      },
    },
  },
);

export type BadgeVariantProps = VariantProps<typeof badgeVariants>;

export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<'span'> & BadgeVariantProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ className, variant }))} {...props} />
  );
}
