import { Skeleton } from '../Skeleton/Skeleton'

// Shaped like the final layout (never the text "Loading…") -- the
// toolbar row, then a grid of card-height blocks standing in for the
// default cards view.
export function ModelsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => index).map((index) => (
          <Skeleton key={index} className="h-40 w-full" />
        ))}
      </div>
    </div>
  )
}
