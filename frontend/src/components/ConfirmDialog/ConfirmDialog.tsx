import type { ReactNode } from 'react'
import { Button } from '../Button/Button'
import { Dialog } from '../Dialog/Dialog'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  confirming?: boolean
}

// The one way a costly or destructive action gets confirmed (ground
// rule 14) -- never window.confirm. `description` should state exactly
// what happens, e.g. "Cancel run #14? The SLURM job is stopped."
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  confirming = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? 'danger' : 'primary'} loading={confirming} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}
