import { useState } from 'react'
import { Ban } from 'lucide-react'
import { toast } from 'sonner'
import { useCancelRun } from '../../api/queries/runs'
import { describeError } from '../../utils/describeError'
import { Button } from '../Button/Button'
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog'

interface RunCancelButtonProps {
  runId: number
  className?: string
}

// The one cancel confirmation for a run (ground rule 14: never
// `window.confirm`) -- the run report's own header action and the
// Runs table's own row action both render this same component. The
// description names exactly what `worker.cancel_run` actually does: it
// writes 'cancelled' immediately, then tears down the model server
// only if no other run is still using it (Trap T4).
export function RunCancelButton({ runId, className }: RunCancelButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const cancelRun = useCancelRun()

  function handleConfirm(): void {
    cancelRun.mutate(runId, {
      onSuccess: () => {
        setConfirmOpen(false)
        toast.success(`Run #${runId} cancelled`)
      },
      onError: (error) => {
        toast.error(`Could not cancel run #${runId}: ${describeError(error)}`)
      },
    })
  }

  return (
    <>
      <Button variant="danger" size="sm" className={className} onClick={() => setConfirmOpen(true)}>
        <Ban className="h-4 w-4" aria-hidden="true" />
        Cancel
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Cancel run #${runId}?`}
        description="The evaluation stops now and no score is recorded. Its model server is shut down too, unless another run is still using it."
        confirmLabel="Cancel run"
        destructive
        confirming={cancelRun.isPending}
        onConfirm={handleConfirm}
      />
    </>
  )
}
