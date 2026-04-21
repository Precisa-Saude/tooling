import { Toast as ToastPrimitive } from '@base-ui/react/toast';
import { XIcon } from 'lucide-react';

import { cn } from '../utils/cn.js';

export const ToastProvider: typeof ToastPrimitive.Provider = ToastPrimitive.Provider;
// Explicit type annotation required: the inferred type references an internal
// Base UI path that tsc can't emit stably in .d.ts (TS2742).
export const ToastPortal: typeof ToastPrimitive.Portal = ToastPrimitive.Portal;

/**
 * For the imperative `useToastManager()` hook (add / remove toasts from
 * event handlers outside the component tree), import it directly from
 * Base UI — we don't re-export it to avoid type/value disambiguation
 * under `isolatedModules`:
 *
 * @example
 *   import { useToastManager } from '@base-ui/react/toast';
 *   const toast = useToastManager();
 *   toast.add({ title: 'Saved', description: 'Profile updated.', type: 'success' });
 */

export function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        'fixed bottom-4 right-4 z-50 flex max-h-screen w-full max-w-sm flex-col gap-2',
        'sm:bottom-4 sm:right-4',
        className,
      )}
      {...props}
    />
  );
}

export function ToastRoot({ className, ...props }: ToastPrimitive.Root.Props) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      className={cn(
        'group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden',
        'rounded-lg border bg-background p-4 pr-8 shadow-lg',
        'data-[type=success]:border-[var(--status-success)]/30',
        'data-[type=error]:border-[var(--status-critical)]/30',
        'data-[type=warning]:border-[var(--status-warning)]/30',
        'data-[type=info]:border-[var(--status-info)]/30',
        'data-open:animate-in data-open:slide-in-from-right-full',
        'data-closed:animate-out data-closed:slide-out-to-right-full data-closed:fade-out-80',
        className,
      )}
      {...props}
    />
  );
}

export function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn('text-sm font-semibold', className)}
      {...props}
    />
  );
}

export function ToastDescription({ className, ...props }: ToastPrimitive.Description.Props) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export function ToastAction({ className, ...props }: ToastPrimitive.Action.Props) {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      className={cn(
        'inline-flex h-7 shrink-0 items-center justify-center rounded-md bg-transparent px-3 text-xs font-medium',
        'transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export function ToastClose({ className, ...props }: ToastPrimitive.Close.Props) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      className={cn(
        'absolute right-2 top-2 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity',
        'hover:text-foreground focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'group-hover:opacity-100',
        className,
      )}
      aria-label="Close"
      {...props}
    >
      <XIcon className="size-3.5" />
    </ToastPrimitive.Close>
  );
}
