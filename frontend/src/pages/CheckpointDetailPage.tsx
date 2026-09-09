import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment, useState } from 'react'
import { Link } from 'react-router'
import { apiFetch, type CheckpointDetail, type CheckpointListItem } from '../api/client'
import { AvailabilityBadge } from '../components/AvailabilityBadge/AvailabilityBadge'
import { CheckpointInferredPanel } from '../components/CheckpointInferredPanel/CheckpointInferredPanel'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { servingProfileDisplayName } from '../utils/servingProfileDisplayName'
import {
  formatRelativeTime,
  groupByFamily,
  parentName,
  toggleExpandedId,
} from './CheckpointDetailPage.helper'

export function CheckpointDetailPage() {
  const queryClient = useQueryClient()
  const [expandedIds, setExpandedIds] = useState<number[]>([])

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['checkpoints'],
    queryFn: () => apiFetch<CheckpointListItem[]>('/checkpoints'),
  })

  // One mutation instance shared by every row's "Check availability"
  // button (R-D34 -- this is the only thing that ever triggers a
  // check). TanStack v5 keeps the last mutate() argument on `variables`
  // even after it settles, which is what a per-row pending/error state
  // needs (R-T29) without a second piece of state to keep in sync.
  const validateMutation = useMutation({
    mutationFn: (checkpointId: number) =>
      apiFetch<CheckpointDetail>(`/checkpoints/${checkpointId}/validate`, { method: 'POST' }),
    onSuccess: (updatedCheckpoint) => {
      queryClient.invalidateQueries({ queryKey: ['checkpoints'] })
      // Keeps an already-expanded panel showing the re-check's result
      // instead of the stale detail it fetched on expand.
      queryClient.setQueryData(['checkpoint', updatedCheckpoint.id], updatedCheckpoint)
    },
  })
  const validatingCheckpointId = validateMutation.isPending ? validateMutation.variables : null

  function toggleExpanded(checkpointId: number) {
    setExpandedIds((current) => toggleExpandedId(current, checkpointId))
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Checkpoints</h1>
          <p className="mt-2 max-w-2xl text-slate-400">Every registered checkpoint, grouped by family.</p>
        </div>
        <Link
          to="/checkpoints/register"
          className="shrink-0 rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Register checkpoint
        </Link>
      </div>

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading checkpoints…</p>}

      {isError && <p className="mt-6 text-sm text-red-400">Could not load checkpoints: {String(error)}</p>}

      {data && data.length === 0 && (
        <div className="mt-6">
          <EmptyState message="No checkpoints registered yet" />
        </div>
      )}

      {data && data.length > 0 && (
        <div className="mt-6 space-y-8">
          {[...groupByFamily(data)].map(([family, familyCheckpoints]) => (
            <section key={family}>
              <h2 className="text-sm font-medium text-slate-400">{family}</h2>
              <table className="mt-2 w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
                      Name
                    </th>
                    <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
                      Availability
                    </th>
                    <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
                      Path
                    </th>
                    <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
                      Serving profile
                    </th>
                    <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
                      Parent
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {familyCheckpoints.map((checkpoint) => {
                    const isExpanded = expandedIds.includes(checkpoint.id)
                    // R-D1 made visible: the row never disappears when
                    // the weights behind it vanish, it just dims --
                    // registration and weight availability are tracked
                    // independently.
                    const isUnavailable = checkpoint.availability_status === 'unavailable'

                    return (
                      <Fragment key={checkpoint.id}>
                        <tr className={isUnavailable ? 'opacity-60' : ''}>
                          <td className="border-b border-slate-800/50 p-2 text-slate-200">
                            <button
                              type="button"
                              onClick={() => toggleExpanded(checkpoint.id)}
                              className="flex items-center gap-1.5 text-left hover:text-white"
                            >
                              <span className="text-xs text-slate-500">{isExpanded ? '▾' : '▸'}</span>
                              {checkpoint.name}
                            </button>
                          </td>
                          <td className="border-b border-slate-800/50 p-2">
                            <div className="flex flex-col items-start gap-1">
                              <div className="flex items-center gap-2">
                                <AvailabilityBadge status={checkpoint.availability_status} />
                                {checkpoint.availability_checked_at && (
                                  <span className="text-xs text-slate-500">
                                    {formatRelativeTime(checkpoint.availability_checked_at)}
                                  </span>
                                )}
                              </div>
                              {isUnavailable && (
                                <p className="text-xs text-red-400">
                                  Registration is intact -- only the weights are missing.
                                  {checkpoint.availability_detail && ` ${checkpoint.availability_detail}`}
                                </p>
                              )}
                              {checkpoint.availability_status === 'incomplete' &&
                                checkpoint.availability_detail && (
                                  <p className="text-xs text-amber-400">{checkpoint.availability_detail}</p>
                                )}
                              <button
                                type="button"
                                disabled={validatingCheckpointId === checkpoint.id}
                                onClick={() => validateMutation.mutate(checkpoint.id)}
                                className="rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                              >
                                {validatingCheckpointId === checkpoint.id
                                  ? 'Checking…'
                                  : 'Check availability'}
                              </button>
                              {validateMutation.isError && validateMutation.variables === checkpoint.id && (
                                <p className="text-xs text-red-400">{String(validateMutation.error)}</p>
                              )}
                            </div>
                          </td>
                          <td className="border-b border-slate-800/50 p-2 font-mono text-xs text-slate-400">
                            {checkpoint.path}
                          </td>
                          <td className="border-b border-slate-800/50 p-2 text-slate-300">
                            {servingProfileDisplayName(
                              checkpoint.serving_profile_label,
                              checkpoint.serving_profile_hash,
                            )}
                          </td>
                          <td className="border-b border-slate-800/50 p-2 text-slate-300">
                            {parentName(checkpoint, data)}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={5} className="border-b border-slate-800/50 bg-slate-950/40 p-3">
                              <CheckpointInferredPanel checkpointId={checkpoint.id} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
