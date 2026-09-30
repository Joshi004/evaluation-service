// Shared options for catalog-like list queries (checkpoints, standards,
// sampling profiles, serving profiles) -- reference data that changes
// only when someone registers, submits, or reloads the catalog, not on
// every navigation. A longer staleTime plus no window-focus refetch
// cuts requests the frontend would otherwise repeat for the same
// answer; every mutation that can actually change one of these lists
// invalidates its own query explicitly (RegisterModelPage,
// useCreateRuns, CatalogPanel), so a real change is never hidden behind
// this staleness window.
export const CATALOG_QUERY_OPTIONS = {
  staleTime: 5 * 60_000,
  refetchOnWindowFocus: false,
} as const
