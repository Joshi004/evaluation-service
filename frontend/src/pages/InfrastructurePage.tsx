import { useState } from 'react'
import { toast } from 'sonner'
import type { EndpointListItem } from '../api/client'
import { useCheckpoints } from '../api/queries/checkpoints'
import { useEndpoints, useStartEndpoint } from '../api/queries/endpoints'
import { useServingProfiles } from '../api/queries/servingProfiles'
import { Button } from '../components/Button/Button'
import { ClusterPartitionsCard } from '../components/ClusterPartitionsCard/ClusterPartitionsCard'
import { ModelServerList } from '../components/ModelServerList/ModelServerList'
import { PageHeader } from '../components/PageHeader/PageHeader'
import { Spinner } from '../components/Spinner/Spinner'
import { StartModelServerDialog } from '../components/StartModelServerDialog/StartModelServerDialog'
import { SystemHealthCard } from '../components/SystemHealthCard/SystemHealthCard'
import { describeStartFailure } from '../utils/describeStartFailure'

// Owns the one useEndpoints() poll, the one useCheckpoints() catalog
// read, and the one useStartEndpoint mutation -- ModelServerList and
// StartModelServerDialog each read these as props rather than running
// their own, so there is never a second 5s poller or a second start
// in flight: the page allows one start at a time.
export function InfrastructurePage() {
  const [startDialogOpen, setStartDialogOpen] = useState(false)
  const endpoints = useEndpoints()
  const checkpoints = useCheckpoints()
  const servingProfiles = useServingProfiles()

  function handleStarted(endpoint: EndpointListItem): void {
    setStartDialogOpen(false)
    toast.success(`Model server ready: ${endpoint.checkpoint_name}`)
  }

  function handleFailed(error: Error, checkpointId: number): void {
    const modelName = checkpoints.data?.find((checkpoint) => checkpoint.id === checkpointId)?.name ?? 'the model'
    // Stays until dismissed, unlike every other toast in the app --
    // this one can arrive minutes after the dialog closed, so sonner's
    // usual few-second auto-dismiss would likely be missed entirely.
    toast.error(describeStartFailure(error, modelName), { duration: Infinity })
  }

  const startEndpoint = useStartEndpoint({ onStarted: handleStarted, onFailed: handleFailed })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Endpoints"
        description="Model servers running on the cluster, the cluster's partitions, and system health."
        actions={
          <Button onClick={() => setStartDialogOpen(true)}>
            {startEndpoint.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Spinner />
                {'Starting\u2026'}
              </span>
            ) : (
              'Start a model server'
            )}
          </Button>
        }
      />

      <ModelServerList endpoints={endpoints} onStartClick={() => setStartDialogOpen(true)} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ClusterPartitionsCard />
        <SystemHealthCard />
      </div>

      <StartModelServerDialog
        open={startDialogOpen}
        onOpenChange={setStartDialogOpen}
        checkpoints={checkpoints}
        servingProfiles={servingProfiles}
        liveEndpoints={endpoints.data ?? []}
        startEndpoint={startEndpoint}
      />
    </div>
  )
}
