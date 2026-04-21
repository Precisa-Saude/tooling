import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import type { ComponentProps, ReactElement, ReactNode } from 'react';

import { cn } from '../utils/cn.js';

export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  align = 'center',
  alignOffset = 0,
  children,
  className,
  side = 'top',
  sideOffset = 6,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            'z-50 max-w-xs rounded-md bg-popover px-2.5 py-1.5 text-xs text-popover-foreground',
            'shadow-md ring-1 ring-foreground/10',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
            'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
            'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
            'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            className,
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

/**
 * Convenience wrapper that composes Provider + Root + Trigger + Content for
 * the common single-tooltip case. Use the named sub-components directly for
 * finer control (e.g. nested tooltips, custom portals).
 */
export function Tooltip({
  children,
  content,
  side,
  sideOffset,
  ...providerProps
}: {
  /** The element that triggers the tooltip on hover/focus. Must be a single ReactElement (Base UI renders it via the `render` prop). */
  children: ReactElement;
  content: ReactNode;
  side?: TooltipPrimitive.Positioner.Props['side'];
  sideOffset?: number;
} & ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipProvider {...providerProps}>
      <TooltipRoot>
        <TooltipTrigger render={children} />
        <TooltipContent side={side} sideOffset={sideOffset}>
          {content}
        </TooltipContent>
      </TooltipRoot>
    </TooltipProvider>
  );
}
