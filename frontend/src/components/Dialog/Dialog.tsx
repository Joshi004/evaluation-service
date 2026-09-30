import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { IconButton } from '../IconButton/IconButton'
import { dialogContentClassName, type DialogSize } from './Dialog.helper'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  // Defaults to 'md' -- every dialog before this prop existed
  // (ConfirmDialog, plain forms) keeps that same width unchanged.
  // Compare is the first caller to reach for 'lg'/'xl'.
  size?: DialogSize
  className?: string
}

// Every modal in the app -- confirmations (via ConfirmDialog), forms,
// detail panels -- opens through this rather than a hand-rolled
// overlay. `title` is required: Radix warns in development if a
// dialog has no accessible title, and every real use needs one anyway.
export function Dialog({ open, onOpenChange, title, description, children, size = 'md', className }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* A scrim dims the page behind the dialog regardless of theme,
            so it stays a fixed black rather than a token that would
            flip (and lighten) in the light theme. */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <DialogPrimitive.Content className={dialogContentClassName(size, className)}>
          <div className="flex items-start justify-between gap-4">
            <DialogPrimitive.Title className="text-lg font-semibold text-foreground">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <IconButton aria-label="Close" size="sm">
                <X className="h-4 w-4" />
              </IconButton>
            </DialogPrimitive.Close>
          </div>
          {description && (
            <DialogPrimitive.Description className="mt-2 text-sm text-muted-foreground">
              {description}
            </DialogPrimitive.Description>
          )}
          {children && <div className="mt-4">{children}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
