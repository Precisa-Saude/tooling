import { Accordion as AccordionPrimitive } from '@base-ui/react/accordion';
import { ChevronDownIcon } from 'lucide-react';

import { cn } from '../utils/cn.js';

export const Accordion: typeof AccordionPrimitive.Root = AccordionPrimitive.Root;

export function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn('border-b last:border-b-0', className)}
      {...props}
    />
  );
}

export function AccordionHeader({ className, ...props }: AccordionPrimitive.Header.Props) {
  return (
    <AccordionPrimitive.Header
      data-slot="accordion-header"
      className={cn('flex', className)}
      {...props}
    />
  );
}

export function AccordionTrigger({
  children,
  className,
  ...props
}: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionHeader>
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          'flex flex-1 items-center justify-between gap-4 py-4 text-left text-sm font-medium',
          'transition-all outline-none',
          'hover:underline',
          'focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:pointer-events-none disabled:opacity-50',
          '[&[data-panel-open]>svg]:rotate-180',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionHeader>
  );
}

export function AccordionPanel({ children, className, ...props }: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-panel"
      className={cn(
        'overflow-hidden text-sm',
        'data-[starting-style]:h-0 data-[ending-style]:h-0',
        'transition-[height] duration-200',
        className,
      )}
      {...props}
    >
      <div className="pt-0 pb-4">{children}</div>
    </AccordionPrimitive.Panel>
  );
}
