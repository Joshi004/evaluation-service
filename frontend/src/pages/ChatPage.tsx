import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import type { EndpointListItem } from '../api/client'
import { useCheckpoints } from '../api/queries/checkpoints'
import { useEndpoints, useStartEndpoint } from '../api/queries/endpoints'
import { useSamplingProfiles } from '../api/queries/samplingProfiles'
import { useServingProfiles } from '../api/queries/servingProfiles'
import { Badge } from '../components/Badge/Badge'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../components/Button/Button.helper'
import { ChatConversation } from '../components/ChatConversation/ChatConversation'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { ErrorState } from '../components/ErrorState/ErrorState'
import { ModelName } from '../components/ModelName/ModelName'
import { PageHeader } from '../components/PageHeader/PageHeader'
import { PageSkeleton } from '../components/PageSkeleton/PageSkeleton'
import { StartModelServerDialog } from '../components/StartModelServerDialog/StartModelServerDialog'
import { describeStartFailure } from '../utils/describeStartFailure'
import { paths } from '../utils/paths'
import { buildChatModelRows } from './ChatPage.helper'

// The manual chat playground: /chat lists every model worth chatting
// with (a live server, or history saved from an earlier one), and
// /chat/:modelId is one model's own conversation. Owns the four
// catalog queries both views need and the one StartModelServerDialog
// instance either can open -- mirrors InfrastructurePage.tsx's own
// "one page, one set of queries, children read them as props" shape.
export function ChatPage() {
  const { modelId } = useParams<{ modelId: string }>()
  const checkpointId = modelId === undefined ? null : Number(modelId)

  // Which model the shared start dialog is open for -- null means
  // closed. Rendering the dialog with `key={startDialogCheckpointId}`
  // (StartModelServerDialog.tsx's own docstring) gives it a fresh,
  // correctly-preselected instance each time a different row or
  // conversation opens it.
  const [startDialogCheckpointId, setStartDialogCheckpointId] = useState<number | null>(null)

  const checkpoints = useCheckpoints()
  const endpoints = useEndpoints()
  const samplingProfiles = useSamplingProfiles()
  const servingProfiles = useServingProfiles()

  function handleStarted(endpoint: EndpointListItem): void {
    setStartDialogCheckpointId(null)
    toast.success(`Model server ready: ${endpoint.checkpoint_name}`)
  }

  function handleFailed(error: Error, failedCheckpointId: number): void {
    const modelName = checkpoints.data?.find((checkpoint) => checkpoint.id === failedCheckpointId)?.name ?? 'the model'
    // Stays until dismissed, same as InfrastructurePage's own -- a cold
    // start can fail minutes after this dialog closed.
    toast.error(describeStartFailure(error, modelName), { duration: Infinity })
  }

  const startEndpoint = useStartEndpoint({ onStarted: handleStarted, onFailed: handleFailed })

  function handleStartDialogOpenChange(open: boolean): void {
    if (!open) {
      setStartDialogCheckpointId(null)
    }
  }

  const isLoading =
    checkpoints.isLoading || endpoints.isLoading || samplingProfiles.isLoading || servingProfiles.isLoading
  if (isLoading) {
    return <PageSkeleton />
  }

  const isError = checkpoints.isError || endpoints.isError || samplingProfiles.isError || servingProfiles.isError
  if (isError) {
    return (
      <ErrorState
        message="Could not load the chat page"
        details={String(checkpoints.error ?? endpoints.error ?? samplingProfiles.error ?? servingProfiles.error)}
        onRetry={() => {
          checkpoints.refetch()
          endpoints.refetch()
          samplingProfiles.refetch()
          servingProfiles.refetch()
        }}
      />
    )
  }

  if (!checkpoints.data || !endpoints.data || !samplingProfiles.data || !servingProfiles.data) {
    return null
  }

  const startDialog = (
    <StartModelServerDialog
      key={startDialogCheckpointId}
      open={startDialogCheckpointId !== null}
      onOpenChange={handleStartDialogOpenChange}
      checkpoints={checkpoints}
      servingProfiles={servingProfiles}
      liveEndpoints={endpoints.data}
      startEndpoint={startEndpoint}
      initialCheckpointId={startDialogCheckpointId}
    />
  )

  if (checkpointId === null) {
    const rows = buildChatModelRows(checkpoints.data, endpoints.data)
    return (
      <div className="space-y-6">
        <PageHeader
          title="Chat"
          description="Talk directly to any model with a running server, to check it by hand."
        />
        {rows.length === 0 ? (
          <EmptyState
            title="No models to chat with yet"
            description="Start a model server from Endpoints, then come back here."
            actions={
              <Link to={paths.infrastructure()} className={buttonClassName('primary', BUTTON_LABEL_SIZE.md)}>
                Go to Endpoints
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {rows.map((row) => (
              <div key={row.checkpoint.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <ModelName name={row.checkpoint.name} family={row.checkpoint.family} />
                  {row.liveEndpointCount > 0 ? (
                    <Badge tone="success">Serving</Badge>
                  ) : (
                    <Badge tone="neutral">No server running</Badge>
                  )}
                </div>
                <Link to={paths.chat(row.checkpoint.id)} className={buttonClassName('primary', BUTTON_LABEL_SIZE.sm)}>
                  Chat
                </Link>
              </div>
            ))}
          </div>
        )}
        {startDialog}
      </div>
    )
  }

  const checkpoint = checkpoints.data.find((candidate) => candidate.id === checkpointId) ?? null
  if (checkpoint === null) {
    return (
      <EmptyState
        title="Model not found"
        description="It may have been removed, or the link has a typo."
        actions={
          <Link to={paths.chat()} className={buttonClassName('primary', BUTTON_LABEL_SIZE.md)}>
            Back to Chat
          </Link>
        }
      />
    )
  }

  const defaultSamplingProfile =
    samplingProfiles.data.find((profile) => profile.id === checkpoint.default_sampling_profile_id) ?? null
  if (defaultSamplingProfile === null) {
    // Shouldn't happen -- default_sampling_profile_id is a foreign key
    // -- but useChatConversation requires a real profile, so this
    // guards that rather than passing it something invalid.
    return <ErrorState message="This model's default sampling profile could not be found." />
  }

  const liveEndpointsForCheckpoint = endpoints.data.filter((endpoint) => endpoint.checkpoint_id === checkpoint.id)

  return (
    <div className="space-y-6">
      <ChatConversation
        key={checkpoint.id}
        checkpoint={checkpoint}
        defaultSamplingProfile={defaultSamplingProfile}
        samplingProfiles={samplingProfiles.data}
        servingProfiles={servingProfiles.data}
        liveEndpointsForCheckpoint={liveEndpointsForCheckpoint}
        onStartServerClick={() => setStartDialogCheckpointId(checkpoint.id)}
      />
      {startDialog}
    </div>
  )
}
