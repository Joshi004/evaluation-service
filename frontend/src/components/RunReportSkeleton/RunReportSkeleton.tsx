import { Skeleton } from '../Skeleton/Skeleton'

// Shaped like the final layout (§4.5: never the text "Loading…") --
// a breadcrumb-height line, the header's two identity/meta rows, the
// verdict band's own height, and a tab strip.
export function RunReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-28 w-full" />
      <div className="flex gap-4 border-b border-border pb-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
}
