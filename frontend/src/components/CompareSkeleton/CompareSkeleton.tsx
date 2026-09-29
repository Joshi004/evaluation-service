import { Skeleton } from '../Skeleton/Skeleton'

// Shaped like the final layout (§4.5: never the text "Loading…") --
// stands in for either of Compare's two shapes (the start state's own
// picker, or a loaded comparison's header-plus-table), since both are
// a header block followed by a table-ish block.
export function CompareSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <Skeleton className="h-9 w-full rounded-none" />
        {Array.from({ length: 4 }, (_, index) => index).map((rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-6 border-t border-border px-3 py-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
