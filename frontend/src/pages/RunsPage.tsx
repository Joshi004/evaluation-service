import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { apiFetch, type RunGroupCancellation, type RunListItem } from '../api/client'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { StatusBadge } from '../components/StatusBadge/StatusBadge'
import { formatElapsedTime } from '../utils/formatElapsedTime'
import { formatFractionAsPercent } from '../utils/formatFractionAsPercent'
import { recipeDisplayName } from '../utils/recipeDisplayName'
import { groupRunsByGroup, isCancellable } from './RunsPage.helper'

export function RunsPage() {
  const queryClient = useQueryClient()

  const runs = useQuery({
    queryKey: ['runs'],
    queryFn: () => apiFetch<RunListItem[]>('/runs'),
    // The page people leave open (module docstring) -- keeps status,
    // elapsed time and truncation live without a manual refresh, the
    // same choice EndpointsPage makes for the same reason.
    refetchInterval: 5000,
  })

  const cancelRunMutation = useMutation({
    mutationFn: (runId: number) => apiFetch<RunListItem>(`/runs/${runId}/cancel`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['runs'] }),
  })

  const cancelGroupMutation = useMutation({
    mutationFn: (runGroupId: number) =>
      apiFetch<RunGroupCancellation>(`/run-groups/${runGroupId}/cancel`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['runs'] }),
  })

  function handleCancelRun(runId: number) {
    if (window.confirm(`Cancel run #${runId}?`)) {
      cancelRunMutation.mutate(runId)
    }
  }

  function handleCancelGroup(runGroupId: number, runGroupName: string) {
    if (window.confirm(`Cancel every non-finished run in "${runGroupName}"?`)) {
      cancelGroupMutation.mutate(runGroupId)
    }
  }

  const sections = runs.data ? groupRunsByGroup(runs.data) : null
  const now = new Date()

  return (
    <div>
      <h1 className="text-2xl font-semibold">Runs</h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        Everything in flight and recent. States, elapsed time, progress, live logs, truncation and
        error rates — the page people leave open. See EVAL_SERVICE_PLAN.md, Section 13.
      </p>

      <div className="mt-8">
        {runs.isLoading && <p className="text-sm text-slate-500">Loading runs…</p>}

        {runs.isError && (
          <p className="text-sm text-red-400">Could not load runs: {String(runs.error)}</p>
        )}

        {sections && sections.length === 0 && <EmptyState message="No runs yet" />}

        {sections && sections.length > 0 && (
          <div className="space-y-8">
            {sections.map((section) => {
              const anyCancellable = section.runs.some((run) => isCancellable(run.status))
              return (
                <section key={section.runGroupId}>
                  <header className="flex flex-wrap items-center gap-3">
                    <h2 className="text-sm font-medium text-slate-300">{section.runGroupName}</h2>
                    <span className="text-xs text-slate-500">
                      {section.runs.length} run{section.runs.length === 1 ? '' : 's'}
                    </span>
                    <button
                      type="button"
                      disabled={!anyCancellable || cancelGroupMutation.isPending}
                      onClick={() => handleCancelGroup(section.runGroupId, section.runGroupName)}
                      className="ml-auto rounded border border-red-500/30 px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Cancel group
                    </button>
                  </header>

                  {cancelGroupMutation.isError && cancelGroupMutation.variables === section.runGroupId && (
                    <p className="mt-1 text-xs text-red-400">{String(cancelGroupMutation.error)}</p>
                  )}

                  <table className="mt-2 w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
                          Run
                        </th>
                        <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
                          Status
                        </th>
                        <th className="border-b border-slate-800 p-2 text-right font-medium text-slate-400">
                          Elapsed
                        </th>
                        <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
                          Checkpoint
                        </th>
                        <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
                          Recipe
                        </th>
                        <th className="border-b border-slate-800 p-2 text-right font-medium text-slate-400">
                          Truncation
                        </th>
                        <th className="border-b border-slate-800 p-2 text-left font-medium text-slate-400">
                          Error
                        </th>
                        <th className="border-b border-slate-800 p-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {section.runs.map((run) => (
                        <tr key={run.id}>
                          <td className="border-b border-slate-800/50 p-2">
                            <Link to={`/runs/${run.id}`} className="text-blue-400 hover:underline">
                              #{run.id}
                            </Link>
                          </td>
                          <td className="border-b border-slate-800/50 p-2">
                            <StatusBadge status={run.status} />
                          </td>
                          <td className="border-b border-slate-800/50 p-2 text-right text-slate-200">
                            {formatElapsedTime(run.created_at, run.finished_at, now)}
                          </td>
                          <td className="border-b border-slate-800/50 p-2 text-slate-200">
                            {run.checkpoint_name}
                          </td>
                          <td className="border-b border-slate-800/50 p-2 font-mono text-xs text-slate-300">
                            {recipeDisplayName(run.recipe_label, run.recipe_hash)}
                          </td>
                          <td className="border-b border-slate-800/50 p-2 text-right text-slate-200">
                            {formatFractionAsPercent(run.truncation_rate)}
                          </td>
                          <td className="border-b border-slate-800/50 p-2 text-red-400">
                            {run.error ?? ''}
                          </td>
                          <td className="border-b border-slate-800/50 p-2 text-right">
                            <button
                              type="button"
                              disabled={
                                !isCancellable(run.status) ||
                                (cancelRunMutation.isPending && cancelRunMutation.variables === run.id)
                              }
                              onClick={() => handleCancelRun(run.id)}
                              className="rounded border border-red-500/30 px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            {cancelRunMutation.isError && cancelRunMutation.variables === run.id && (
                              <p className="mt-1 text-red-400">{String(cancelRunMutation.error)}</p>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
