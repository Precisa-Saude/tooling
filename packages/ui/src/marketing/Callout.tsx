import { cva, type VariantProps } from 'class-variance-authority';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  InfoIcon,
  type LucideIcon,
  XCircleIcon,
} from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '../utils/cn.js';

export const calloutVariants = cva(
  [
    'flex w-full gap-3 rounded-lg border p-4 text-sm',
    '[&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0',
  ].join(' '),
  {
    defaultVariants: {
      variant: 'info',
    },
    variants: {
      variant: {
        critical:
          'border-[var(--status-critical)]/20 bg-[var(--status-critical-tint)] text-[var(--status-critical)]',
        info: 'border-[var(--status-info)]/20 bg-[var(--status-info-tint)] text-[var(--status-info)]',
        note: 'border-border bg-muted text-foreground',
        success:
          'border-[var(--status-success)]/20 bg-[var(--status-success-tint)] text-[var(--status-success)]',
        warning:
          'border-[var(--status-warning)]/20 bg-[var(--status-warning-tint)] text-[var(--status-warning)]',
      },
    },
  },
);

export type CalloutVariantProps = VariantProps<typeof calloutVariants>;

const DEFAULT_ICONS: Record<NonNullable<CalloutVariantProps['variant']>, LucideIcon> = {
  critical: XCircleIcon,
  info: InfoIcon,
  note: InfoIcon,
  success: CheckCircleIcon,
  warning: AlertTriangleIcon,
};

export interface CalloutProps
  extends Omit<ComponentProps<'div'>, 'children' | 'title'>, CalloutVariantProps {
  children?: ReactNode;
  /** Override the default icon for the variant. Pass `null` to omit. */
  icon?: ReactNode | null;
  /** Optional title rendered above the body. */
  title?: ReactNode;
}

/**
 * Info / warning / success / critical / note callout block.
 *
 * Colors map to `--status-*` tokens from `@precisa-saude/themes/status.css`.
 * Each variant ships with a default lucide icon; override with `icon`
 * prop (pass `null` to render without an icon).
 */
export function Callout({
  children,
  className,
  icon,
  title,
  variant = 'info',
  ...props
}: CalloutProps) {
  const DefaultIcon = DEFAULT_ICONS[variant ?? 'info'];
  // Three cases: `null` opts out entirely; a ReactNode overrides the default;
  // `undefined` (prop not passed) falls back to the variant's default icon.
  const iconEl = icon === null ? null : icon !== undefined ? icon : <DefaultIcon aria-hidden />;

  return (
    <div
      data-slot="callout"
      role="note"
      className={cn(calloutVariants({ variant }), className)}
      {...props}
    >
      {iconEl}
      <div className="flex-1">
        {title ? <div className="mb-1 font-medium">{title}</div> : null}
        {children}
      </div>
    </div>
  );
}
