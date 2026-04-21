import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { XIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '../utils/cn.js';

export interface MobileDrawerHeader {
  /** Avatar element — typically an image or initials disc. */
  avatar?: ReactNode;
  /** Secondary label (e.g. email). */
  email?: ReactNode;
  /** User's name or identifier. */
  name: ReactNode;
}

export interface MobileDrawerItem {
  /** Mark as destructive (red tint). */
  danger?: boolean;
  /** Navigation target. */
  href?: string;
  /** Leading icon. */
  icon?: ReactNode;
  /** Menu label. */
  label: ReactNode;
  /** Click handler (use for sign-out, etc.). */
  onClick?: () => void;
}

export interface MobileDrawerProps {
  /** Optional footer content (e.g. version string). */
  footer?: ReactNode;
  /** Optional profile header rendered at the top in a tinted bar. */
  header?: MobileDrawerHeader;
  /** Override the header tint (CSS color). Default: `var(--primary)`. */
  headerBackground?: string;
  /** Override the header text color. Default: `var(--primary-foreground)`. */
  headerForeground?: string;
  /** Menu items rendered in order. Use multiple `items` groups to produce divided sections. */
  items: MobileDrawerItem[];
  /** Controlled open state. */
  open: boolean;
  /** Called when the drawer requests to close. */
  onClose: () => void;
}

/**
 * Slide-out drawer for mobile navigation. Wraps the Base UI Dialog
 * primitive. Common shape: optional profile header in a tinted bar,
 * menu list with icons, danger-colored logout at bottom, version
 * footer.
 *
 * Only renders on small viewports when the consumer shows it
 * conditionally — no built-in breakpoint.
 */
export function MobileDrawer({
  footer,
  header,
  headerBackground = 'var(--primary)',
  headerForeground = 'var(--primary-foreground)',
  items,
  onClose,
  open,
}: MobileDrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            'fixed inset-0 z-40 bg-black/50',
            'data-open:animate-in data-open:fade-in-0',
            'data-closed:animate-out data-closed:fade-out-0',
          )}
        />
        <DialogPrimitive.Popup
          data-slot="mobile-drawer"
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-[82vw] max-w-xs flex-col bg-background shadow-xl',
            'data-open:animate-in data-open:slide-in-from-right',
            'data-closed:animate-out data-closed:slide-out-to-right',
          )}
        >
          {header ? (
            <div
              data-slot="mobile-drawer-header"
              className="flex items-center gap-3 px-4 py-4"
              style={{ background: headerBackground, color: headerForeground }}
            >
              {header.avatar ? <div aria-hidden>{header.avatar}</div> : null}
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{header.name}</div>
                {header.email ? (
                  <div className="truncate text-sm opacity-80">{header.email}</div>
                ) : null}
              </div>
              <DialogPrimitive.Close
                aria-label="Close menu"
                className={cn(
                  'rounded-md p-1 opacity-70 transition-opacity',
                  'hover:opacity-100 focus:outline-none focus-visible:ring-2',
                )}
                style={{ color: headerForeground }}
              >
                <XIcon className="size-5" />
              </DialogPrimitive.Close>
            </div>
          ) : (
            <div className="flex justify-end px-4 pt-4">
              <DialogPrimitive.Close
                aria-label="Close menu"
                className="rounded-md p-1 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2"
              >
                <XIcon className="size-5" />
              </DialogPrimitive.Close>
            </div>
          )}

          <nav aria-label="Drawer" className="flex-1 overflow-y-auto py-2">
            <ul className="flex flex-col">
              {items.map((item, i) => {
                const content = (
                  <>
                    {item.icon ? (
                      <span className="text-muted-foreground [&>svg]:size-4" aria-hidden>
                        {item.icon}
                      </span>
                    ) : null}
                    <span className="flex-1">{item.label}</span>
                  </>
                );
                const cls = cn(
                  'flex w-full items-center gap-3 px-5 py-3 text-left text-sm transition-colors',
                  'hover:bg-muted focus:bg-muted focus:outline-none',
                  item.danger && 'text-destructive',
                );
                return (
                  <li key={i}>
                    {item.href ? (
                      <a href={item.href} className={cls} onClick={onClose}>
                        {content}
                      </a>
                    ) : (
                      <button
                        type="button"
                        className={cls}
                        onClick={() => {
                          item.onClick?.();
                          onClose();
                        }}
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {footer ? (
            <div
              data-slot="mobile-drawer-footer"
              className="border-t px-4 py-3 text-center text-xs text-muted-foreground"
            >
              {footer}
            </div>
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
