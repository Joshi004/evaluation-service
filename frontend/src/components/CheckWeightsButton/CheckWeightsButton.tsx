import { useState } from 'react'
import { toast } from 'sonner'
import { useValidateCheckpoint } from '../../api/queries/checkpoints'
import { describeError } from '../../utils/describeError'
import { WEIGHTS_STATUS_LABELS } from '../../utils/labels'
import { Button } from '../Button/Button'
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog'

interface CheckWeightsButtonProps {
  checkpointId: number
  checkpointName: string
  className?: string
}

// The Configuration tab's own "re-check the weights" action --
// guarded by a ConfirmDialog because validate is among the
// always-confirmed operator tools (it re-reads the checkpoint's files
// on the cluster over SSH).
// useValidateCheckpoint's own onSuccess already writes the refreshed
// CheckpointDetail straight into this checkpoint's query cache, so the
// header's availability badge updates in place without this component
// doing anything beyond showing a toast. It never runs on mount.
export function CheckWeightsButton({ checkpointId, checkpointName, className }: CheckWeightsButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const validateCheckpoint = useValidateCheckpoint()

  function handleConfirm(): void {
    validateCheckpoint.mutate(checkpointId, {
      onSuccess: (updated) => {
        setConfirmOpen(false)
        toast.success(`${checkpointName}: ${WEIGHTS_STATUS_LABELS[updated.availability_status]}`)
      },
      onError: (error) => {
        toast.error(`Could not check weights for ${checkpointName}: ${describeError(error)}`)
      },
    })
  }

  return (
    <>
      <Button variant="secondary" size="sm" className={className} onClick={() => setConfirmOpen(true)}>
        Check weights
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Check weights?"
        description={`Reads ${checkpointName}'s files on the cluster over SSH and updates its weights status.`}
        confirmLabel="Check weights"
        confirming={validateCheckpoint.isPending}
        onConfirm={handleConfirm}
      />
    </>
  )
}
