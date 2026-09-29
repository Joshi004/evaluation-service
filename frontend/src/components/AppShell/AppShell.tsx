import { useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Sidebar } from '../Sidebar/Sidebar'
import { TopBar } from '../TopBar/TopBar'
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
      <Sidebar isDrawerOpen={isDrawerOpen} onCloseDrawer={() => setIsDrawerOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar breadcrumb={pageTitle} onOpenDrawer={() => setIsDrawerOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
