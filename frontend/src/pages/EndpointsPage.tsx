import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { apiFetch, type CheckpointListItem, type EndpointListItem } from '../api/client'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { formatTimeRemaining, sumGpus } from './EndpointsPage.helper'

export function EndpointsPage() {
  const queryClient = useQueryClient()
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<number | null>(null)

  const endpoints = useQuery({
    queryKey: ['endpoints'],
    queryFn: () => apiFetch<EndpointListItem[]>('/endpoints'),
    // Keeps time-remaining and kills-by-someone-else live without a
    // manual refresh (Phase 3 plan).
    refetchInterval: 5000,
  })

  // Existing endpoint, no backend change needed -- just populates the
  // "start an endpoint for..." select below.
  const checkpoints = useQuery({
    queryKey: ['checkpoints'],
    queryFn: () => apiFetch<CheckpointListItem[]>('/checkpoints'),
  })

  const startMutation = useMutation({
    mutationFn: (checkpointId: number) =>
      apiFetch<EndpointListItem>('/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkpoint_id: checkpointId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endpoints'] })
    },
  })

  const killMutation = useMutation({
    mutationFn: (endpointId: number) => apiFetch<void>(`/endpoints/${endpointId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endpoints'] })
    },
  })

  function handleStart() {
    if (selectedCheckpointId !== null) {
      startMutation.mutate(selectedCheckpointId)
    }
  }

  function handleKill(endpointId: number) {
    // The simplest correct option -- there's no existing confirm-dialog
    // component to reuse, and building one is disproportionate to a
    // single admin button.
    if (window.confirm('Kill this endpoint? This cancels the SLURM job immediately.')) {
      killMutation.mutate(endpointId)
    }
  }

  const totalGpus = endpoints.data ? sumGpus(endpoints.data) : 0

  return (
    <div>
      <h1 className="text-2xl font-semibold">Endpoints</h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        What's served, on which node and GPUs, idle time, and a manual kill button. See
        EVAL_SERVICE_PLAN.md, Section 13.
      </p>

      <div className="mt-6 max-w-md rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-sm font-medium text-slate-300">Start an endpoint</h2>

        {checkpoints.isLoading && <p className="mt-2 text-sm text-slate-500">Loading checkpoints…</p>}

        {checkpoints.isError && (
          <p className="mt-2 text-sm text-red-400">Could not load checkpoints: {String(checkpoints.error)}</p>
        )}

        {checkpoints.data && (
          <div className="mt-2 flex gap-2">
            <select
              className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
              value={selectedCheckpointId ?? ''}
              onChange={(event) => setSelectedCheckpointId(Number(event.target.value) || null)}
            >
              <option value="">Select a checkpoint…</option>
              {checkpoints.data.map((checkpoint) => (
                <option key={checkpoint.id} value={checkpoint.id}>
                  {checkpoint.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={selectedCheckpointId === null || startMutation.isPending}
              onClick={handleStart}
              className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
            >
              {startMutation.isPending ? 'Starting…' : 'Start'}
            </button>
          </div>
        )}

        {startMutation.isPending && (
          <p className="mt-2 text-sm text-slate-500">
            Starting... this can take several minutes on a cold start.
          </p>
        )}

        {startMutation.isError && <p className="mt-2 text-sm text-red-400">{String(startMutation.error)}</p>}
      </div>

      <div className="mt-8">
        {endpoints.isLoading && <p className="text-sm text-slate-500">Loading endpoints…</p>}

        {endpoints.isError && (
          <p className="text-sm text-red-400">Could not load endpoints: {String(endpoints.error)}</p>
        )}

        {endpoints.data && endpoints.data.length === 0 && <EmptyState message="No live endpoints" />}

        {endpoints.data && endpoints.data.length > 0 && (
          <>
            <p className="mb-2 text-sm text-slate-400">Total GPUs in use: {totalGpus}</p>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
                    Checkpoint
                  </th>
                  <th className="border-b border-slate-800 p-2 text-right font-medium text-slate-400">
                    GPUs
                  </th>
                  <th className="border-b border-slate-800 p-2 text-right font-medium text-slate-400">
                    SLURM job
                  </th>
                  <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
                    URL
                  </th>
                  <th className="border-b border-slate-800 p-2 text-right font-medium text-slate-400">
                    Time remaining
                  </th>
                  <th className="border-b border-slate-800 p-2" />
                </tr>
              </thead>
              <tbody>
                {endpoints.data.map((endpoint) => (
                  <tr key={endpoint.id}>
                    <td className="border-b border-slate-800/50 p-2 text-slate-200">
                      {endpoint.checkpoint_name}
                    </td>
                    <td className="border-b border-slate-800/50 p-2 text-right text-slate-200">
                      {endpoint.gpus}
                    </td>
                    <td className="border-b border-slate-800/50 p-2 text-right text-slate-200">
                      {endpoint.slurm_job_id ?? '—'}
                    </td>
                    <td className="border-b border-slate-800/50 p-2 text-slate-200">{endpoint.url ?? '—'}</td>
                    <td className="border-b border-slate-800/50 p-2 text-right text-slate-200">
                      {formatTimeRemaining(endpoint.expires_at)}
                    </td>
                    <td className="border-b border-slate-800/50 p-2 text-right">
                      <button
                        type="button"
                        disabled={killMutation.isPending && killMutation.variables === endpoint.id}
                        onClick={() => handleKill(endpoint.id)}
                        className="rounded border border-red-500/30 px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        Kill
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {killMutation.isError && <p className="mt-2 text-sm text-red-400">{String(killMutation.error)}</p>}
      </div>
    </div>
  )
}
