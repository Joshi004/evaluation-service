import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'
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

export interface UseRunsOptions {
  // Off for CompareTrayProvider's one-time revalidation fetch, which
  // should only run while a restored tray actually needs checking, not
  // on every render that calls this hook.
  enabled?: boolean
}

// Polls every 5s while anything in the current filtered list is still
// queued or running, and backs off to 30s once nothing is -- the page
// people leave open (RunsPage's own module docstring) doesn't need
// sub-5s freshness once every run in view has already finished. A
// filtered call (e.g. ComparePage's `status: 'done'`) can never contain
// an active run, so it settles at 30s immediately.
export function useRuns(
  filters: RunListFilters = {},
  options: UseRunsOptions = {},
): UseQueryResult<RunListItem[]> {
  return useQuery({
    queryKey: queryKeys.runs(filters),
    queryFn: () => apiFetch<RunListItem[]>(buildRunsPath(filters)),
    refetchInterval: (query) => (hasActiveRun(query.state.data) ? 5_000 : 30_000),
    enabled: options.enabled ?? true,
  })
}

// Keeps status, phase and metrics live while watching a run finish, and
// stops polling once it has (§3 rule 11: "live where it matters, calm
// elsewhere") -- a finished run's own row never changes again, so
// there is nothing a 5s poll would ever catch that a page reload
// wouldn't.
export function useRun(runId: number): UseQueryResult<RunDetail> {
  return useQuery({
    queryKey: queryKeys.run(runId),
    queryFn: () => apiFetch<RunDetail>(`/runs/${runId}`),
    enabled: Number.isFinite(runId),
    refetchInterval: (query) => (isActiveRunStatus(query.state.data?.status ?? '') ? 5000 : false),
  })
}

// The one cancel-run mutation, shared by the run report's own
// RunCancelButton (Phase 7) and RunsPage's row action (inlined there
// today, moved onto this hook once Phase 9 rewrites that page) -- one
// implementation of "what happens after a cancel succeeds" instead of
// two invalidation lists that can drift apart.
export function useCancelRun(): UseMutationResult<RunListItem, Error, number> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (runId: number) => apiFetch<RunListItem>(`/runs/${runId}/cancel`, { method: 'POST' }),
    onSuccess: (_data, runId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.run(runId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.allRuns() })
    },
  })
}
