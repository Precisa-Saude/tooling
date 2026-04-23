import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { MenuIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { Button } from '../primitives/Button.js';
import { cn } from '../utils/cn.js';

export interface HeaderProps extends Omit<ComponentProps<'nav'>, 'children'> {
  /** Right-side slot (login link, CTA pill, etc.). */
  actions?: ReactNode;
  /** Extra content rendered next to the logo (e.g. environment badge). */
  afterLogo?: ReactNode;
  /** Root classes. Default: card background with bottom border. */
  className?: string;
  /** Classes applied to the centered container. */
  containerClassName?: string;
  /**
   * Classes applied to the inner content row. When set, the header renders
   * in **grid mode** (logo / nav / actions placed at fixed grid columns).
   * When unset, the header renders in **flex mode** (logo left, actions
   * right, nav absolutely centered).
   */
  contentClassName?: string;
  /** Hide the hamburger button entirely (e.g. for minimal error pages). */
  hideMenuButton?: boolean;
  /** Hamburger icon color. */
  iconClassName?: string;
  /** Controlled open state of the mobile drawer. */
  isMobileMenuOpen: boolean;
  /** Brand/logo rendered on the left. */
  logo: ReactNode;
  /**
   * Content of the mobile drawer. Falls back to `navItems` when not set.
   * Consumers typically assemble: logo button → nav list → dividers →
   * secondary links → CTA stack → version pill.
   */
  mobileNavItems?: ReactNode;
  /** Desktop navigation content (grid-column styled children in grid mode). */
  navItems?: ReactNode;
  /** Called when the mobile drawer opens or closes. */
  onToggleMobileMenu: (open: boolean) => void;
}

/**
 * Shared top navigation bar. Two layout modes:
 *
 * - **Flex mode** (default): logo left, actions right, nav absolutely
 *   centered. Use for simple top bars.
 * - **Grid mode** (pass `contentClassName`): logo, nav items and actions
 *   place themselves at fixed columns of the shared `--grid-cols` grid.
 *   Use to keep the bar aligned with the site's content grid.
 *
 * The mobile drawer is a Base UI Dialog rendered as a right-side
 * slide-out. The top strip of the drawer matches the header height and
 * color, so the hamburger → X transition feels like the header expanding
 * into a menu.
 */
export function Header({
  actions,
  afterLogo,
  className = 'bg-card border-b border-border',
  containerClassName = 'container mx-auto px-4',
  contentClassName,
  hideMenuButton = false,
  iconClassName = 'text-foreground',
  isMobileMenuOpen,
  logo,
  mobileNavItems,
  navItems,
  onToggleMobileMenu,
  ...props
}: HeaderProps) {
  const isGrid = Boolean(contentClassName);

  return (
    <nav
      data-slot="header"
      className={cn('fixed top-0 right-0 left-0 z-50 transition-all duration-300', className)}
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        viewTransitionName: 'header',
      }}
      {...props}
    >
      <div className={containerClassName}>
        <div
          className={contentClassName ?? 'flex h-14 items-center justify-between'}
          style={
            isGrid
              ? {
                  gridTemplateColumns: 'repeat(var(--grid-cols), 1fr)',
                  margin: '0 auto',
                  maxWidth: 'var(--grid-max-w)',
                }
              : undefined
          }
        >
          <div
            data-slot="header-logo"
            className={cn(
              'flex h-full shrink-0 items-center gap-2',
              isGrid &&
                '[grid-column:1/span_3] md:[grid-column:2/span_2] 3xl:[grid-column:3/span_2]',
            )}
          >
            {logo}
            {afterLogo}
          </div>

          {/* Grid mode: inline nav. Flex mode: absolutely centered below. */}
          {navItems && isGrid ? (
            <div data-slot="header-nav" className="hidden h-full lg:contents">
              {navItems}
            </div>
          ) : null}

          <div
            data-slot="header-actions"
            className={cn(
              'flex h-full shrink-0 items-center justify-end gap-1 overflow-visible',
              isGrid &&
                '[grid-column:13/span_2] md:[grid-column:11/span_3] lg:contents 3xl:[grid-column:12/span_3]',
            )}
          >
            {actions ? (
              <div className={isGrid ? 'contents' : 'flex h-full items-center'}>{actions}</div>
            ) : null}

            <DialogPrimitive.Root open={isMobileMenuOpen} onOpenChange={onToggleMobileMenu}>
              {!hideMenuButton ? (
                <DialogPrimitive.Trigger
                  render={
                    <Button
                      aria-label="Open menu"
                      variant="ghost"
                      size="icon"
                      className={cn('!size-9 flex-none p-0', isGrid ? 'lg:hidden' : 'md:hidden')}
                    >
                      <MenuIcon className={cn('h-6 w-6', iconClassName)} />
                    </Button>
                  }
                />
              ) : null}

              <DialogPrimitive.Portal>
                <DialogPrimitive.Backdrop
                  className={cn(
                    'fixed inset-0 z-40 bg-black/50',
                    'data-open:animate-in data-open:fade-in-0',
                    'data-closed:animate-out data-closed:fade-out-0',
                  )}
                />
                <DialogPrimitive.Popup
                  data-slot="header-drawer"
                  className={cn(
                    'fixed inset-y-0 right-0 z-50 flex w-[280px] flex-col bg-background shadow-xl',
                    'data-open:animate-in data-open:slide-in-from-right',
                    'data-closed:animate-out data-closed:slide-out-to-right',
                  )}
                >
                  <DialogPrimitive.Title className="sr-only">
                    Menu de navegação
                  </DialogPrimitive.Title>
                  <div
                    aria-hidden
                    className="-ml-px w-[calc(100%+1px)] shrink-0 bg-primary"
                    style={{ height: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}
                  />
                  <div className="flex min-h-0 flex-1 flex-col">{mobileNavItems ?? navItems}</div>
                </DialogPrimitive.Popup>
              </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
          </div>
        </div>
      </div>

      {/* Flex-mode centered nav overlay. */}
      {navItems && !isGrid ? (
        <div className="pointer-events-none absolute inset-0 hidden items-center justify-center md:flex">
          <div className="pointer-events-auto flex h-full items-center">{navItems}</div>
        </div>
      ) : null}
    </nav>
  );
}
