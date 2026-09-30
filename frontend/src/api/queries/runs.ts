import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import {
  apiFetch,
  type CreateRunsRequest,
  type RunDetail,
  type RunGroupCancellation,
  type RunListFilters,
  type RunListItem,
  type RunPreview,
  type RunPreviewRequest,
  type RunSubmission,
} from '../client'
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

// Shared by useRuns' own refetchInterval below and the Runs page's own
// live indicator (LiveIndicator) -- "5s while something in view is
// active, else 30s" is one computation both read, not two literals
// that could drift apart.
export function runsPollIntervalMs(runs: RunListItem[] | undefined): number {
  return hasActiveRun(runs) ? 5_000 : 30_000
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
    refetchInterval: (query) => runsPollIntervalMs(query.state.data),
    enabled: options.enabled ?? true,
  })
}

// Keeps status, phase and metrics live while watching a run finish, and
// stops polling once it has -- a finished run's own row never changes
// again, so there is nothing a 5s poll would ever catch that a page
// reload wouldn't. Factored out of useRun so Compare's own
// useRunsById can fetch several runs in parallel through the exact
// same options -- one implementation of "how a run is fetched and
// polled", not two that could drift apart.
export function runQueryOptions(runId: number) {
  return queryOptions({
    queryKey: queryKeys.run(runId),
    queryFn: () => apiFetch<RunDetail>(`/runs/${runId}`),
    enabled: Number.isFinite(runId),
    refetchInterval: (query) => (isActiveRunStatus(query.state.data?.status ?? '') ? 5000 : false),
  })
}

export function useRun(runId: number): UseQueryResult<RunDetail> {
  return useQuery(runQueryOptions(runId))
}

// Compare's own "every run in ?runs=" fetch -- each run is its own
// cache entry (queryKeys.run(id)), shared with useRun, so opening a
// compared run's own report page never re-fetches what this page
// already loaded.
export function useRunsById(runIds: number[]): UseQueryResult<RunDetail>[] {
  return useQueries({ queries: runIds.map((runId) => runQueryOptions(runId)) })
}

// The one cancel-run mutation, shared by the run report's own
// RunCancelButton and the Runs table's own row action (a
// RunCancelButton reuse) -- one implementation of "what happens after
// a cancel succeeds" instead of two invalidation lists that can drift
// apart.
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

// The batch cancel mutation, moved out of RunsPage's own inlined
// mutation so RunGroupCancelButton owns no fetch logic of its own --
// the same "one hook, one invalidation list" reasoning as
// useCancelRun above.
// Also invalidates each cancelled run's own detail cache, in case its
// report page happens to be open in another tab.
export function useCancelRunGroup(): UseMutationResult<RunGroupCancellation, Error, number> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (runGroupId: number) =>
      apiFetch<RunGroupCancellation>(`/run-groups/${runGroupId}/cancel`, { method: 'POST' }),
    onSuccess: (cancellation) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.allRuns() })
      for (const runId of cancellation.cancelled_run_ids) {
        queryClient.invalidateQueries({ queryKey: queryKeys.run(runId) })
      }
    },
  })
}

// New evaluation's own dry-run preview -- moved out of
// SubmitPage.tsx's own inlined query so NewEvaluationWizard owns no
// fetch logic of its own, the same "one hook, one call site's worth
// of comments" reasoning as useCancelRun above. `request` is built by
// the caller from its own current selection and overrides; the query
// key is the same object, so the two can never drift apart
// (queryKeys.runPreview's own docstring).
export function useRunPreview(request: RunPreviewRequest, enabled: boolean): UseQueryResult<RunPreview> {
  return useQuery({
    queryKey: queryKeys.runPreview(request),
    queryFn: () =>
      apiFetch<RunPreview>('/runs/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      }),
    // POST /runs/preview 422s on an empty checkpoint_ids or standard_ids
    // (Field(min_length=1), app/schemas/runs.py) -- the caller passes
    // `enabled` false until its own grid has both axes selected.
    enabled,
    // Keeps the last preview on screen while a new one loads, instead
    // of blanking out to a loading state on every checkbox click or
    // settled keystroke -- New evaluation's own "live" framing for its
    // findings and setup-alignment lines implies updating in place, not
    // flickering.
    placeholderData: keepPreviousData,
  })
}

// The one submit mutation (`POST /runs`) -- moved out of SubmitPage.tsx
// for the same reason useRunPreview was above. Every catalog a submit
// can mint a new row in gets invalidated here once, rather than at
// each call site: a submit with a label on any override mints a new
// standard, sampling profile and/or serving profile, and the catalog
// queries' own multi-minute staleTime (CATALOG_QUERY_OPTIONS) would
// otherwise hide it until that window passes.
export function useCreateRuns(): UseMutationResult<RunSubmission, Error, CreateRunsRequest> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: CreateRunsRequest) =>
      apiFetch<RunSubmission>('/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.allRuns() })
      queryClient.invalidateQueries({ queryKey: queryKeys.standards() })
      queryClient.invalidateQueries({ queryKey: queryKeys.samplingProfiles() })
      queryClient.invalidateQueries({ queryKey: queryKeys.servingProfiles() })
    },
  })
}
