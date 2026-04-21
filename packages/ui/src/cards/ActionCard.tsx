import { cva, type VariantProps } from 'class-variance-authority';
import { ChevronRightIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '../utils/cn.js';

export const actionCardVariants = cva(
  [
    'group flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    defaultVariants: {
      variant: 'default',
    },
    variants: {
      variant: {
        default: 'bg-card text-card-foreground hover:bg-muted',
        subtle: 'border-transparent bg-muted text-foreground hover:bg-muted/70',
      },
    },
  },
);

export type ActionCardVariantProps = VariantProps<typeof actionCardVariants>;

type Common = {
  /** Leading icon (typically a lucide icon in a soft-tinted circle). */
  icon?: ReactNode;
  /** Primary label. */
  title: ReactNode;
  /** Secondary label rendered below the title. */
  subtitle?: ReactNode;
  /** Custom trailing element (defaults to a right-chevron). Pass `null` to omit. */
  trailing?: ReactNode | null;
} & ActionCardVariantProps;

export type ActionCardProps =
  | (Common & { href: string; onClick?: never } & Omit<
        ComponentProps<'a'>,
        'title' | 'children' | 'href'
      >)
  | (Common & { href?: undefined; onClick?: ComponentProps<'button'>['onClick'] } & Omit<
        ComponentProps<'button'>,
        'title' | 'children' | 'onClick'
      >);

/**
 * Clickable card with a leading icon, title + optional subtitle, and a
 * trailing chevron. Renders as `<a>` when `href` is provided, otherwise
 * as `<button>`.
 *
 * @example
 *   <ActionCard
 *     icon={<AppleIcon />}
 *     title="Alimentação"
 *     subtitle="4 para aumentar"
 *     href="/plano/alimentacao"
 *   />
 */
export function ActionCard({
  className,
  icon,
  subtitle,
  title,
  trailing,
  variant,
  ...props
}: ActionCardProps) {
  const children = (
    <>
      {icon ? (
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-primary',
            'group-hover:bg-background',
            '[&>svg]:size-5',
          )}
          aria-hidden
        >
          {icon}
        </div>
      ) : null}
      <div className="flex-1 min-w-0">
        <div className="truncate text-sm font-medium">{title}</div>
        {subtitle ? <div className="truncate text-xs text-muted-foreground">{subtitle}</div> : null}
      </div>
      {trailing === null ? null : trailing !== undefined ? (
        trailing
      ) : (
        <ChevronRightIcon
          className="pointer-events-none size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      )}
    </>
  );

  if ('href' in props && props.href) {
    const { href, ...rest } = props;
    return (
      <a
        data-slot="action-card"
        className={cn(actionCardVariants({ variant }), className)}
        href={href}
        {...rest}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      data-slot="action-card"
      type="button"
      className={cn(actionCardVariants({ variant }), className)}
      {...(props as ComponentProps<'button'>)}
    >
      {children}
    </button>
  );
}
