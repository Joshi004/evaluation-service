import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { apiFetch, type CheckpointDetail, type CheckpointListItem } from '../client'
import { CATALOG_QUERY_OPTIONS } from './catalogQueryOptions'
import { queryKeys } from './queryKeys'

export function useCheckpoints(): UseQueryResult<CheckpointListItem[]> {
  return useQuery({
    queryKey: queryKeys.checkpoints(),
    queryFn: () => apiFetch<CheckpointListItem[]>('/checkpoints'),
    ...CATALOG_QUERY_OPTIONS,
  })
}

// Fetched lazily -- only CheckpointInferredPanel calls this, when a
// checkpoints-page row is actually expanded, not for every row on load.
export function useCheckpoint(checkpointId: number): UseQueryResult<CheckpointDetail> {
  return useQuery({
    queryKey: queryKeys.checkpoint(checkpointId),
    queryFn: () => apiFetch<CheckpointDetail>(`/checkpoints/${checkpointId}`),
    ...CATALOG_QUERY_OPTIONS,
  })
}
