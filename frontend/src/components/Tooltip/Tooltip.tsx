import type { ReactNode } from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '../../utils/cn'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  className?: string
}

// Wraps Radix's Tooltip so callers pass a trigger and its label as two
// props instead of composing Root/Trigger/Portal/Content themselves.
// TooltipProvider (shared open delay, one instance for the whole app)
// is mounted once in main.tsx.
export function Tooltip({ content, children, className }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className={cn(
            'z-50 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-foreground shadow-md',
            className,
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-popover" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
