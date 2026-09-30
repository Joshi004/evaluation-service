import { Suspense, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useRuns } from '../../api/queries/runs'
import { CompareTray } from '../CompareTray/CompareTray'
import { PageSkeleton } from '../PageSkeleton/PageSkeleton'
import { Sidebar } from '../Sidebar/Sidebar'
import { TopBar } from '../TopBar/TopBar'
import { paths } from '../../utils/paths'
import { countActiveRuns } from '../../utils/runStatus'
import { useCompareTray } from '../../utils/useCompareTray'
import { resolvePageTitle } from './AppShell.helper'
import { useDocumentTitle } from '../../utils/useDocumentTitle'

// Replaces App.tsx (Phase 2): a grouped sidebar + top bar around every
// route, instead of nine equal top-nav links. Page width (Page vs
// PageWide) is each route's own concern in routes.tsx, not this
// component's -- AppShell only owns the chrome around <Outlet />.
export function AppShell() {
  const location = useLocation()
  const pageTitle = resolvePageTitle(location.pathname)
  useDocumentTitle(pageTitle)

  const { pinnedRuns } = useCompareTray()
  // The same unfiltered `runs` cache entry the Runs page and the
  // Leaderboard's own activity strip read (queryKeys.runs({})) -- every
  // observer of one query key shares one poll, so this adds no second
  // request, just a second reader of data already being fetched.
  const runs = useRuns()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Closing the drawer when the route changes -- so a link clicked
  // inside it doesn't leave it open over the page it just routed to --
  // adjusts state during render (React's recommended pattern for
  // "reset on prop change") rather than in an effect, which would cost
  // an extra commit-and-rerender for every navigation.
  const [renderedPathname, setRenderedPathname] = useState(location.pathname)
  if (location.pathname !== renderedPathname) {
    setRenderedPathname(location.pathname)
    setIsDrawerOpen(false)
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg"
      >
        Skip to content
      </a>
      <Sidebar
        isDrawerOpen={isDrawerOpen}
        onCloseDrawer={() => setIsDrawerOpen(false)}
        badgeCountsByPath={{
          [paths.compare()]: pinnedRuns.length,
          [paths.runs()]: countActiveRuns(runs.data ?? []),
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar breadcrumb={pageTitle} onOpenDrawer={() => setIsDrawerOpen(true)} />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto focus:outline-none">
          {/* Every route element is its own lazy chunk (routes.tsx) --
              this is the one boundary that catches all of them, so the
              sidebar and top bar around it stay mounted rather than
              disappearing during every navigation. */}
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
        <CompareTray />
      </div>
    </div>
  )
}
