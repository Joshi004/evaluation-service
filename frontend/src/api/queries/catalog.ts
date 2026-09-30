// The catalog-status query plus the three catalog-admin mutations
// (reload/prune/delete), parameterised by a CatalogResourceDescriptor
// so ManageCatalogButton, CatalogHealthBanner and the restyled
// CatalogPanel all share one implementation across the three catalogs
// (Phase 12, docs/UI_REDESIGN_PLAN.md §8.12) rather than each page
// wiring its own copy the way the pre-Phase-12 CatalogPanel.tsx did
// inline.
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { CatalogResourceDescriptor } from '../../utils/catalogResources'
import { apiFetch, type CatalogPruneResult, type CatalogStatus } from '../client'
import { queryKeys } from './queryKeys'

export function useCatalogStatus(resource: CatalogResourceDescriptor): UseQueryResult<CatalogStatus> {
  return useQuery({
    queryKey: queryKeys.catalogStatus(resource.resourcePath),
    queryFn: () => apiFetch<CatalogStatus>(`${resource.resourcePath}/catalog-status`),
  })
}

// Every mutation below changes both what catalog-status would report
// and what the resource's own value list holds, so both queries need
// to be invalidated together -- never just one, or the drawer and the
// page above it could disagree about whether a row still exists.
function invalidateCatalog(queryClient: QueryClient, resource: CatalogResourceDescriptor): void {
  queryClient.invalidateQueries({ queryKey: queryKeys.catalogStatus(resource.resourcePath) })
  queryClient.invalidateQueries({ queryKey: resource.listQueryKey })
}

// The reload response (the resource's own summary list) isn't read --
// invalidating the two queries above is what refreshes the screen, so
// this mutation exists purely to trigger the POST and report failure.
export function useReloadCatalog(resource: CatalogResourceDescriptor): UseMutationResult<unknown, Error, void> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<unknown[]>(`${resource.resourcePath}/reload`, { method: 'POST' }),
    onSuccess: () => invalidateCatalog(queryClient, resource),
  })
}

export function usePruneCatalog(
  resource: CatalogResourceDescriptor,
): UseMutationResult<CatalogPruneResult, Error, void> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<CatalogPruneResult>(`${resource.resourcePath}/prune`, { method: 'POST' }),
    onSuccess: () => invalidateCatalog(queryClient, resource),
  })
}

// One mutation instance shared by every row's Delete button (each
// call site keeps its own useDeleteCatalogRow(resource) instance) --
// the same "TanStack keeps the last mutate() argument on `variables`"
// pattern the pre-Phase-12 CatalogPanel.tsx already used for a
// per-row pending/error state without a second piece of state to keep
// in sync.
export function useDeleteCatalogRow(resource: CatalogResourceDescriptor): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (rowId: number) => apiFetch<void>(`${resource.resourcePath}/${rowId}`, { method: 'DELETE' }),
    onSuccess: () => invalidateCatalog(queryClient, resource),
  })
}
