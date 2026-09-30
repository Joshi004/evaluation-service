import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { apiFetch, type HealthResponse } from '../client'
import { queryKeys } from './queryKeys'

// Polls every 30s -- the top bar's status pill is on screen everywhere,
// so a slower interval than the old per-page connectivity widget's 10s
// is still enough to read as "live".
export function useHealth(): UseQueryResult<HealthResponse> {
  return useQuery({
    queryKey: queryKeys.health(),
    queryFn: () => apiFetch<HealthResponse>('/health'),
    refetchInterval: 30_000,
  })
}
