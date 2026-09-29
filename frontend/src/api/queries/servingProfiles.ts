import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { apiFetch, type ServingProfileSummary } from '../client'
import { CATALOG_QUERY_OPTIONS } from './catalogQueryOptions'
import { queryKeys } from './queryKeys'

export function useServingProfiles(): UseQueryResult<ServingProfileSummary[]> {
  return useQuery({
    queryKey: queryKeys.servingProfiles(),
    queryFn: () => apiFetch<ServingProfileSummary[]>('/serving-profiles'),
    ...CATALOG_QUERY_OPTIONS,
  })
}
