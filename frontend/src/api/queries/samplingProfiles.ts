import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { apiFetch, type SamplingProfileSummary } from '../client'
import { CATALOG_QUERY_OPTIONS } from './catalogQueryOptions'
import { queryKeys } from './queryKeys'

export function useSamplingProfiles(): UseQueryResult<SamplingProfileSummary[]> {
  return useQuery({
    queryKey: queryKeys.samplingProfiles(),
    queryFn: () => apiFetch<SamplingProfileSummary[]>('/sampling-profiles'),
    ...CATALOG_QUERY_OPTIONS,
  })
}
