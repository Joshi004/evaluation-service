import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '../../utils/cn'

interface HoverCardProps {
  trigger: ReactNode
  children: ReactNode
  className?: string
}

// A short grace delay before closing -- moving the pointer from the
// trigger to the card, or losing focus to a child inside it, shouldn't
// flash the card shut before the matching enter/focus handler has a
// chance to cancel it.
const CLOSE_DELAY_MS = 150

// A card that opens on hover *or* focus and stays open while the
// pointer or keyboard focus is anywhere inside it -- built on Popover
// rather than Radix's own HoverCard primitive (not installed, and its
// content is deliberately taken out of the tab order, which would fail
// "reach every control via keyboard" for a card with its own action
// buttons). Rendered with no <Popover.Portal>: Popover defaults to
// non-modal (no focus trap -- see PopoverContentNonModal in
// @radix-ui/react-popover), so the card sits in the DOM right after its
// trigger and Tab moves forward into it exactly like any other in-flow
// content, rather than jumping to wherever a portal happened to attach
// it at the end of <body>. Popper still positions it with `strategy:
// fixed`, so it is not clipped by a scrolling table container either.
export function HoverCard({ trigger, children, className }: HoverCardProps) {
  const [open, setOpen] = useState(false)
  const closeTimeoutRef = useRef<number | undefined>(undefined)

  function cancelClose(): void {
    window.clearTimeout(closeTimeoutRef.current)
  }

  function scheduleClose(): void {
    cancelClose()
    closeTimeoutRef.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS)
  }

  function openNow(): void {
    cancelClose()
    setOpen(true)
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      {/* `display: contents` so this wrapper adds no box of its own --
          it exists only to give the enter/leave/focus/blur handlers one
          shared boundary covering both the trigger and the card, which
          is what lets "pointer moved from the trigger onto the card"
          read as staying inside rather than as a leave-then-enter. */}
      <span
        className="contents"
        onMouseEnter={openNow}
        onMouseLeave={scheduleClose}
        onFocus={openNow}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            scheduleClose()
          }
        }}
      >
        <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
        <PopoverPrimitive.Content
          sideOffset={6}
          // Opening on hover must never steal keyboard focus -- only
          // Tab (a real keyboard action) should move focus into the
          // card's own actions.
          onOpenAutoFocus={(event) => event.preventDefault()}
          className={cn(
            'z-50 w-72 rounded-lg border border-border bg-popover p-3 text-sm text-foreground shadow-md',
            className,
          )}
        >
          {children}
        </PopoverPrimitive.Content>
      </span>
    </PopoverPrimitive.Root>
  )
}
