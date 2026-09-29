import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { apiFetch, type EndpointListItem } from '../client'
import { queryKeys } from './queryKeys'

// Keeps time-remaining and kills-by-someone-else live without a manual
// refresh.
export function useEndpoints(): UseQueryResult<EndpointListItem[]> {
  return useQuery({
    queryKey: queryKeys.endpoints(),
    queryFn: () => apiFetch<EndpointListItem[]>('/endpoints'),
    refetchInterval: 5000,
  })
}
