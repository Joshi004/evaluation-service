import { Skeleton } from '../Skeleton/Skeleton'

// Shaped like ModelServerList's own header-plus-card-grid (§4.5:
// "shaped like the final layout") -- three cards is enough to read as
// "a list of servers" without matching any one real count.
export function ModelServersSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-4 w-48" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-48 w-full" />
        ))}
      </div>
    </div>
  )
}
