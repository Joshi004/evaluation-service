import { Skeleton } from '../Skeleton/Skeleton'

// The Suspense fallback for a lazy-loaded route chunk. Used in two
// different places (routes.tsx's outer boundary around AppShell's own
// <Outlet />, and the inner one each tabbed page adds around its own
// nested <Outlet />) that can't share a real header: the outer one
// covers a whole page whose shape isn't known yet, and the inner one
// sits below a header and tab strip that are already on screen. This
// stays content-only for both reasons -- no title or tab-strip lines
// that would either guess wrong or double up on the real ones.
export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
