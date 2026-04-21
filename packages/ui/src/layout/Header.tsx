import { MenuIcon, XIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { Button } from '../primitives/Button.js';
import { cn } from '../utils/cn.js';

export interface HeaderNavItem {
  /** Whether this nav item represents the active page. */
  active?: boolean;
  /** Target href. */
  href: string;
  /** Leading icon. */
  icon?: ReactNode;
  /** Link label. */
  label: ReactNode;
}

export interface HeaderProps extends Omit<ComponentProps<'header'>, 'children'> {
  /** Action slot on the right (e.g. login button, CTA). */
  actions?: ReactNode;
  /** Brand/logo element rendered on the left. */
  logo: ReactNode;
  /** Whether the mobile drawer/menu is currently open. */
  mobileOpen?: boolean;
  /** Desktop navigation items. */
  navItems?: HeaderNavItem[];
  /** Whether to render the mobile toggle button. Default: `true` when onToggleMobile is set. */
  showMobileToggle?: boolean;
  /** Called when the user taps the mobile menu button. */
  onToggleMobile?: () => void;
}

/**
 * Fixed top navigation bar. Desktop shows the full nav; mobile shows
 * logo + actions + menu toggle button. Consumers wire the drawer
 * component (`MobileDrawer`) themselves, controlling its open state
 * via `mobileOpen` / `onToggleMobile`.
 */
export function Header({
  actions,
  className,
  logo,
  mobileOpen = false,
  navItems,
  onToggleMobile,
  showMobileToggle,
  ...props
}: HeaderProps) {
  const renderToggle = showMobileToggle ?? Boolean(onToggleMobile);

  return (
    <header
      data-slot="header"
      className={cn(
        'sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm',
        className,
      )}
      {...props}
    >
      <div className="mx-auto flex h-14 max-w-(--grid-max-w) items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-8">
          <div data-slot="header-logo">{logo}</div>
          {navItems && navItems.length > 0 ? (
            <nav
              aria-label="Primary"
              className="hidden items-center gap-1 text-sm md:flex"
              data-slot="header-nav"
            >
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={item.active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground transition-colors',
                    'hover:text-foreground',
                    'aria-[current=page]:text-foreground aria-[current=page]:font-medium',
                  )}
                >
                  {item.icon ? <span aria-hidden>{item.icon}</span> : null}
                  {item.label}
                </a>
              ))}
            </nav>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {actions ? <div data-slot="header-actions">{actions}</div> : null}
          {renderToggle ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              onClick={onToggleMobile}
              className="md:hidden"
            >
              {mobileOpen ? <XIcon /> : <MenuIcon />}
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
