import { Skeleton } from '../Skeleton/Skeleton'

// Shaped like the final layout (§4.5: never the text "Loading…") -- the
// toolbar's two rows, then a few batch-header-plus-rows groups standing
// in for the table.
export function RunsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        {Array.from({ length: 3 }, (_, groupIndex) => groupIndex).map((groupIndex) => (
          <div key={groupIndex} className="border-t border-border first:border-t-0">
            <div className="flex items-center gap-4 bg-muted px-3 py-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-1.5 w-32 rounded-full" />
            </div>
            {Array.from({ length: 2 }, (_, rowIndex) => rowIndex).map((rowIndex) => (
              <div key={rowIndex} className="flex items-center gap-6 border-t border-border px-3 py-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
