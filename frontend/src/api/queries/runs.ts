import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { apiFetch, type RunDetail, type RunListFilters, type RunListItem } from '../client'
import { isActiveRunStatus } from '../../utils/runStatus'
import { queryKeys } from './queryKeys'

// Builds GET /runs' query string from RunListFilters -- URLSearchParams,
// not string concatenation, since a benchmark name or a hash could in
// principle need escaping.
function buildRunsPath(filters: RunListFilters): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) {
      params.set(key, String(value))
    }
  }
  const query = params.toString()
  return query === '' ? '/runs' : `/runs?${query}`
}

function hasActiveRun(runs: RunListItem[] | undefined): boolean {
  return (runs ?? []).some((run) => isActiveRunStatus(run.status))
}

// Polls every 5s while anything in the current filtered list is still
// queued or running, and backs off to 30s once nothing is -- the page
// people leave open (RunsPage's own module docstring) doesn't need
// sub-5s freshness once every run in view has already finished. A
// filtered call (e.g. ComparePage's `status: 'done'`) can never contain
// an active run, so it settles at 30s immediately.
export function useRuns(filters: RunListFilters = {}): UseQueryResult<RunListItem[]> {
  return useQuery({
    queryKey: queryKeys.runs(filters),
    queryFn: () => apiFetch<RunListItem[]>(buildRunsPath(filters)),
    refetchInterval: (query) => (hasActiveRun(query.state.data) ? 5_000 : 30_000),
  })
}

// Keeps status, phase and metrics live while watching a run finish.
export function useRun(runId: number): UseQueryResult<RunDetail> {
  return useQuery({
    queryKey: queryKeys.run(runId),
    queryFn: () => apiFetch<RunDetail>(`/runs/${runId}`),
    enabled: Number.isFinite(runId),
    refetchInterval: 5000,
  })
}
