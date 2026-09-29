import type { ReactNode } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '../../utils/cn'

interface PopoverProps {
  trigger: ReactNode
  children: ReactNode
  className?: string
  align?: 'start' | 'center' | 'end'
}

// A generic floating panel anchored to a trigger -- filters, small
// forms and previews compose this rather than each building its own
// positioned overlay.
export function Popover({ trigger, children, className, align = 'start' }: PopoverProps) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={6}
          className={cn(
            'z-50 rounded-lg border border-border bg-popover p-3 text-sm text-foreground shadow-md',
            className,
          )}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
