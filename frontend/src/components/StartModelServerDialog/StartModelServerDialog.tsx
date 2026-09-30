import { useState } from 'react'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import type { CheckpointListItem, EndpointListItem, ServingProfileSummary } from '../../api/client'
import { describeError } from '../../utils/describeError'
import { groupCheckpointsByFamily } from '../../utils/familyGroups'
import { formatDuration } from '../../utils/formatDuration'
import { servingProfileDisplayName } from '../../utils/servingProfileDisplayName'
import { useNow } from '../../utils/useNow'
import { Button } from '../Button/Button'
import { Callout } from '../Callout/Callout'
import { Dialog } from '../Dialog/Dialog'
import { KeyValueList } from '../KeyValueList/KeyValueList'
import { SelectField } from '../SelectField/SelectField'
import { Skeleton } from '../Skeleton/Skeleton'
import { Spinner } from '../Spinner/Spinner'
import { describeStartOutcome } from './StartModelServerDialog.helper'

interface StartModelServerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // All three are InfrastructurePage's own queries, passed down rather
  // than re-fetched here, so the page stays the single owner of each
  // (its own useEndpoints is the one 5s poller, not a second one this
  // dialog would otherwise start).
  checkpoints: UseQueryResult<CheckpointListItem[]>
  servingProfiles: UseQueryResult<ServingProfileSummary[]>
  liveEndpoints: EndpointListItem[]
  // InfrastructurePage's own useStartEndpoint -- its onStarted/onFailed
  // toasts live at the hook level (api/queries/endpoints.ts's own
  // comment) so they still fire after this dialog closes; this
  // component only ever calls `.mutate()`.
  startEndpoint: UseMutationResult<EndpointListItem, Error, number>
}

// 1s while a start is in flight, so the elapsed time visibly ticks;
// otherwise a slow 60s tick that never matters since nothing in the
// idle form reads `now`.
const PENDING_TICK_INTERVAL_MS = 1000
const IDLE_TICK_INTERVAL_MS = 60_000

// docs/UI_REDESIGN_PLAN.md §8.13, item 2: pick a model, see exactly
// what starting it costs, then either watch it start or close this and
// get a toast later (Trap: a cold start can take minutes, so this must
// survive the dialog closing -- see useStartEndpoint's own design).
export function StartModelServerDialog({
  open,
  onOpenChange,
  checkpoints,
  servingProfiles,
  liveEndpoints,
  startEndpoint,
}: StartModelServerDialogProps) {
  // Lives on this component, not inside the Dialog primitive's own
  // subtree, so it survives the dialog closing while a start is still
  // in flight -- if that start then fails, reopening falls back to the
  // form with the same model still selected (one click to retry).
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<number | null>(null)

  const now = useNow(startEndpoint.isPending ? PENDING_TICK_INTERVAL_MS : IDLE_TICK_INTERVAL_MS)

  const selectedCheckpoint = checkpoints.data?.find((checkpoint) => checkpoint.id === selectedCheckpointId) ?? null
  const selectedServingProfile =
    selectedCheckpoint === null
      ? null
      : servingProfiles.data?.find((profile) => profile.id === selectedCheckpoint.default_serving_profile_id) ??
        null

  const outcome =
    selectedCheckpoint !== null && selectedServingProfile !== null
      ? describeStartOutcome(selectedCheckpoint, liveEndpoints, selectedServingProfile.gpus)
      : null

  function handleStart(): void {
    if (selectedCheckpointId !== null) {
      startEndpoint.mutate(selectedCheckpointId)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Start a model server"
      description="Hosts one model on cluster GPUs so evaluations, or you directly, can query it."
    >
      {startEndpoint.isPending ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-foreground">
            <Spinner label="Starting" />
            <p className="text-sm">{`Starting ${selectedCheckpoint?.name ?? 'the model server'}\u2026`}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Elapsed {formatDuration(new Date(startEndpoint.submittedAt).toISOString(), null, now)}
          </p>
          <p className="text-sm text-muted-foreground">
            You can close this; you'll get a notification when it's ready or if it fails.
          </p>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="start-model-server-select">
              Model
            </label>
            {checkpoints.isLoading ? (
              <Skeleton className="mt-1 h-9 w-full" />
            ) : (
              <SelectField
                id="start-model-server-select"
                className="mt-1"
                value={selectedCheckpointId ?? ''}
                onChange={(event) => {
                  const rawValue = event.target.value
                  setSelectedCheckpointId(rawValue === '' ? null : Number(rawValue))
                }}
              >
                <option value="">Select a model…</option>
                {groupCheckpointsByFamily(checkpoints.data ?? []).map((group) => (
                  <optgroup key={group.key} label={group.label}>
                    {group.checkpoints.map((checkpoint) => (
                      <option key={checkpoint.id} value={checkpoint.id}>
                        {checkpoint.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </SelectField>
            )}
            {checkpoints.isError && (
              <p className="mt-1 text-sm text-danger">Could not load models: {describeError(checkpoints.error)}</p>
            )}
          </div>

          {selectedCheckpoint && (
            <KeyValueList
              rows={[
                {
                  label: 'Serving profile',
                  value: servingProfileDisplayName(
                    selectedCheckpoint.serving_profile_label,
                    selectedCheckpoint.serving_profile_hash,
                  ),
                },
                { label: 'GPUs', value: selectedServingProfile?.gpus ?? '\u2014' },
                // POST /endpoints has no partition field -- it always
                // lands on whichever the backend picks as default.
                { label: 'Cluster partition', value: 'Default partition' },
              ]}
            />
          )}

          {outcome && <Callout tone={outcome.tone}>{outcome.message}</Callout>}

          {/* No inline error box here on failure -- InfrastructurePage's
              own toast (hook-level, describeStartFailure) is the one
              failure message (plan decision #2); this just falls back
              to the plain form, ready to retry. */}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={selectedCheckpointId === null} onClick={handleStart}>
              Start server
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
