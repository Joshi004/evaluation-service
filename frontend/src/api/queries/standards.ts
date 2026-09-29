import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { apiFetch, type StandardSummary } from '../client'
import { CATALOG_QUERY_OPTIONS } from './catalogQueryOptions'
import { queryKeys } from './queryKeys'

export function useStandards(): UseQueryResult<StandardSummary[]> {
  return useQuery({
    queryKey: queryKeys.standards(),
    queryFn: () => apiFetch<StandardSummary[]>('/standards'),
    ...CATALOG_QUERY_OPTIONS,
  })
}
