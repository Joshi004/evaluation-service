import { useState } from 'react'
import { Ban } from 'lucide-react'
import { toast } from 'sonner'
import type { EndpointListItem } from '../../api/client'
import { useKillEndpoint } from '../../api/queries/endpoints'
import { describeError } from '../../utils/describeError'
import { Button } from '../Button/Button'
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog'
import { killModelServerDescription } from './KillModelServerButton.helper'

interface KillModelServerButtonProps {
  endpoint: Pick<EndpointListItem, 'id' | 'checkpoint_name' | 'slurm_job_id' | 'gpus'>
  className?: string
}

// The model server card's own Kill -- mirrors RunCancelButton's own
// shape. Ground rule 14: never `window.confirm`, which is exactly what
// the legacy EndpointsPage used to call.
export function KillModelServerButton({ endpoint, className }: KillModelServerButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const killEndpoint = useKillEndpoint()

  function handleConfirm(): void {
    killEndpoint.mutate(endpoint.id, {
      onSuccess: () => {
        setConfirmOpen(false)
        toast.success(`Killed the model server for ${endpoint.checkpoint_name}`)
      },
      onError: (error) => {
        toast.error(`Could not kill the model server for ${endpoint.checkpoint_name}: ${describeError(error)}`)
      },
    })
  }

  return (
    <>
      <Button variant="danger" size="sm" className={className} onClick={() => setConfirmOpen(true)}>
        <Ban className="h-4 w-4" aria-hidden="true" />
        Kill
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Kill the model server for ${endpoint.checkpoint_name}?`}
        description={killModelServerDescription(endpoint)}
        confirmLabel="Kill server"
        destructive
        confirming={killEndpoint.isPending}
        onConfirm={handleConfirm}
      />
    </>
  )
}
