import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import {
  apiFetch,
  type CheckpointCandidate,
  type CheckpointDetail,
  type CheckpointInspection,
  type CheckpointListItem,
  type RegisterCheckpointRequest,
} from '../client'
import { CATALOG_QUERY_OPTIONS } from './catalogQueryOptions'
import { queryKeys } from './queryKeys'

export function useCheckpoints(): UseQueryResult<CheckpointListItem[]> {
  return useQuery({
    queryKey: queryKeys.checkpoints(),
    queryFn: () => apiFetch<CheckpointListItem[]>('/checkpoints'),
    ...CATALOG_QUERY_OPTIONS,
  })
}

// `enabled: Number.isFinite(checkpointId)` guards a not-yet-parsed URL
// id (`/models/abc`) -- ModelDetailPage reads `Number(params.modelId)`
// before it has validated the param, so this hook must tolerate NaN
// without firing a request for it.
export function useCheckpoint(checkpointId: number): UseQueryResult<CheckpointDetail> {
  return useQuery({
    queryKey: queryKeys.checkpoint(checkpointId),
    queryFn: () => apiFetch<CheckpointDetail>(`/checkpoints/${checkpointId}`),
    enabled: Number.isFinite(checkpointId),
    ...CATALOG_QUERY_OPTIONS,
  })
}

// Ground rule 15: never poll an SSH-backed read. `enabled: false` --
// the registration wizard's own "Browse the cluster" button calls
// `refetch()` explicitly; this never fires on mount or on window focus
// (mirrors useClusterPartitions' own reasoning in api/queries/cluster.ts,
// minus that hook's localStorage cache, which candidates has no need
// for -- a candidate list a week old is far more likely to be wrong
// than a partition list a week old).
export function useCheckpointCandidates(): UseQueryResult<CheckpointCandidate[]> {
  return useQuery({
    queryKey: queryKeys.checkpointCandidates(),
    queryFn: () => apiFetch<CheckpointCandidate[]>('/checkpoints/candidates'),
    enabled: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  })
}

// Runs once a candidate is chosen (`enabled: reference !== null`), then
// stays put -- `staleTime: Infinity` and no refetch on focus, since
// re-reading the same checkpoint's config off the cluster because a
// browser tab regained focus is exactly the SSH-on-focus ground rule 15
// forbids. `retry: false` -- the step 2 inspection panel has its own
// Retry button instead of TanStack Query retrying silently.
export function useCheckpointInspection(reference: string | null): UseQueryResult<CheckpointInspection> {
  return useQuery({
    queryKey: queryKeys.checkpointInspection(reference),
    queryFn: () =>
      apiFetch<CheckpointInspection>('/checkpoints/candidates/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      }),
    enabled: reference !== null,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  })
}

// The Configuration tab's own Check weights action -- validate is an
// always-confirmed operator tool, never run on mount. Updates both the
// checkpoints list and this checkpoint's own cached detail in place,
// so the header's weights badge reflects the result without a second
// round trip.
export function useValidateCheckpoint(): UseMutationResult<CheckpointDetail, Error, number> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (checkpointId: number) =>
      apiFetch<CheckpointDetail>(`/checkpoints/${checkpointId}/validate`, { method: 'POST' }),
    onSuccess: (updatedCheckpoint) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checkpoints() })
      queryClient.setQueryData(queryKeys.checkpoint(updatedCheckpoint.id), updatedCheckpoint)
    },
  })
}

// Keeps today's three invalidations (checkpoints, candidates -- the
// newly-registered reference now shows already_registered, and
// serving-profiles -- a customised choice persists a new profile row).
// Navigating to the new model's own page on success is RegisterModelPage's
// own concern (its mutate() call's onSuccess), not this hook's.
export function useRegisterCheckpoint(): UseMutationResult<CheckpointDetail, Error, RegisterCheckpointRequest> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: RegisterCheckpointRequest) =>
      apiFetch<CheckpointDetail>('/checkpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checkpoints() })
      queryClient.invalidateQueries({ queryKey: queryKeys.checkpointCandidates() })
      queryClient.invalidateQueries({ queryKey: queryKeys.servingProfiles() })
    },
  })
}
