import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { IconButton } from '../IconButton/IconButton'
import { sidePanelContentClassName } from './SidePanel.helper'

interface SidePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  // A sticky action row (e.g. "Cancel" / "Done") -- kept visible while
  // `children` scrolls, the same reason Sidebar's own mobile drawer
  // keeps its close button outside the scrolling nav list.
  footer?: ReactNode
  className?: string
}

// Dialog's right-docked sibling: a wide form or detail view read
// naturally as a drawer -- New evaluation's own "Customize" panels are
// its first caller -- reads on top of the page instead of taking over
// its centre. Built on the same Radix Dialog primitive as Dialog.tsx
// (so it gets the same focus trap, Escape-to-close and scroll lock for
// free), just positioned and sized differently; reach for `Dialog`
// instead when the content is short enough to read as a centred
// modal.
export function SidePanel({ open, onOpenChange, title, description, children, footer, className }: SidePanelProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <DialogPrimitive.Content className={sidePanelContentClassName(className)}>
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border p-4">
            <div>
              <DialogPrimitive.Title className="text-base font-semibold text-foreground">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton aria-label="Close" size="sm">
                <X className="h-4 w-4" />
              </IconButton>
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
          {footer && <div className="shrink-0 border-t border-border p-4">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
