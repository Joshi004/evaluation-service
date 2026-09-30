import { useState } from 'react'
import { Ban } from 'lucide-react'
import { toast } from 'sonner'
import { useCancelRunGroup } from '../../api/queries/runs'
import { describeError } from '../../utils/describeError'
import { Button } from '../Button/Button'
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog'

interface RunGroupCancelButtonProps {
  runGroupId: number
  runGroupName: string
  // How many runs the button's own caller already knows are queued or
  // running, at render time -- only used to word the confirmation; the
  // toast after cancelling reads the response's own count instead (see
  // below).
  cancellableCount: number
  className?: string
}

// "Cancel batch" -- modelled on RunCancelButton, but for every
// non-terminal run in one batch at once. The backend's own
// cancel_run_group (services/runs/worker.py) skips a run that races to
// a terminal state between listing and cancelling rather than failing
// the whole request, so the toast reads the response's own
// `cancelled_run_ids` count rather than assuming it matches
// `cancellableCount` -- a batch that finishes on its own between
// render and click cancels nothing, which is reported as information,
// not an error.
export function RunGroupCancelButton({
  runGroupId,
  runGroupName,
  cancellableCount,
  className,
}: RunGroupCancelButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const cancelRunGroup = useCancelRunGroup()

  function handleConfirm(): void {
    cancelRunGroup.mutate(runGroupId, {
      onSuccess: (cancellation) => {
        setConfirmOpen(false)
        const cancelledCount = cancellation.cancelled_run_ids.length
        if (cancelledCount > 0) {
          toast.success(`Cancelled ${cancelledCount} run${cancelledCount === 1 ? '' : 's'} in "${runGroupName}"`)
        } else {
          toast.info(`Nothing left to cancel in "${runGroupName}"`)
        }
      },
      onError: (error) => {
        toast.error(`Could not cancel "${runGroupName}": ${describeError(error)}`)
      },
    })
  }

  return (
    <>
      <Button variant="danger" size="sm" className={className} onClick={() => setConfirmOpen(true)}>
        <Ban className="h-4 w-4" aria-hidden="true" />
        Cancel batch
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Cancel "${runGroupName}"?`}
        description={`${cancellableCount} queued or running run${cancellableCount === 1 ? '' : 's'} will stop now with no score recorded. Their model servers are shut down too, unless another run is still using them.`}
        confirmLabel="Cancel batch"
        destructive
        confirming={cancelRunGroup.isPending}
        onConfirm={handleConfirm}
      />
    </>
  )
}
