import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { apiFetch, type EndpointListItem } from '../client'
import { queryKeys } from './queryKeys'

// Exported so ModelServerList's own LiveIndicator can state the
// real interval without a second literal that could drift from this
// one (the same "one computation, not two" reasoning runsPollIntervalMs
// already documents for the Runs page).
export const ENDPOINTS_POLL_INTERVAL_MS = 5000

// Keeps time-remaining and kills-by-someone-else live without a manual
// refresh.
export function useEndpoints(): UseQueryResult<EndpointListItem[]> {
  return useQuery({
    queryKey: queryKeys.endpoints(),
    queryFn: () => apiFetch<EndpointListItem[]>('/endpoints'),
    refetchInterval: ENDPOINTS_POLL_INTERVAL_MS,
  })
}

interface StartEndpointCallbacks {
  onStarted: (endpoint: EndpointListItem) => void
  onFailed: (error: Error, checkpointId: number) => void
}

// POST /endpoints blocks for the full cold start (minutes), so its
// feedback lives in these hook-level callbacks rather than in the
// caller's own `mutate()` call: TanStack Query only runs a `mutate()`
// callback while the observer that issued it still has listeners
// (query-core/mutationObserver.ts's own `hasListeners()` guard), which
// a closed dialog or a page navigation would trip. The options object
// passed to useMutation itself has no such guard -- Mutation.execute
// calls it unconditionally -- so a toast fired from here still reaches
// the user after they've moved on (docs/UI_REDESIGN_PLAN.md §8.13,
// item 2's "if the dialog is closed, report completion or failure with
// a toast").
export function useStartEndpoint({
  onStarted,
  onFailed,
}: StartEndpointCallbacks): UseMutationResult<EndpointListItem, Error, number> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (checkpointId: number) =>
      apiFetch<EndpointListItem>('/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkpoint_id: checkpointId }),
      }),
    // onSettled, not just onSuccess: a rejected sbatch submission still
    // leaves a row behind for the router to 502/504 on (the endpoint
    // lifecycle's own `expire_endpoint` call happens after that response
    // reaches this hook), so the list needs refreshing either way.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.endpoints() })
    },
    onSuccess: onStarted,
    onError: (error, checkpointId) => onFailed(error, checkpointId),
  })
}

export function useKillEndpoint(): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (endpointId: number) => apiFetch<void>(`/endpoints/${endpointId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.endpoints() })
    },
  })
}
