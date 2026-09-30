import { Skeleton } from '../Skeleton/Skeleton'

// Shaped like SamplingProfilesTab/ServingProfilesTab's own final
// layout: a toolbar row (count text, Manage catalog button), then a
// handful of table rows -- mirrors CatalogPanel's own loading rows.
export function ProfilesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  )
}
