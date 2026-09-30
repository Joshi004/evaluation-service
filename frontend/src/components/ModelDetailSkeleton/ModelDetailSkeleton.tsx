import { Skeleton } from '../Skeleton/Skeleton'

// Shaped like the final layout (never the text "Loading…") -- a
// breadcrumb-height line, the header's title and two meta lines, a
// tab strip, then a content placeholder -- mirrors RunReportSkeleton's
// own reasoning for the model page.
export function ModelDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="h-4 w-48 max-w-full" />
      </div>
      <div className="flex gap-4 border-b border-border pb-2">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
}
