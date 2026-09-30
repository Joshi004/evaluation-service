import { Skeleton } from '../Skeleton/Skeleton'

// Shaped like the final layout, never the text "Loading…" -- a
// toolbar-height row, a header-height bar, then a handful of
// row-height bars standing in for the matrix.
export function LeaderboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <Skeleton className="h-9 w-full rounded-none" />
        <Skeleton className="h-11 w-full rounded-none" />
        {Array.from({ length: 6 }, (_, index) => index).map((rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-6 border-t border-border px-3 py-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
