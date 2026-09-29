import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { Badge } from '../Badge/Badge'
import { cn } from '../../utils/cn'

interface TabNavItem {
  to: string
  label: ReactNode
  // NavLink's own exact-match flag -- the index tab of a nested route
  // (e.g. a run report's Overview, mounted at the bare `/runs/:runId`)
  // needs this so it doesn't stay "active" once the URL moves on to a
  // sibling tab that starts with the same path.
  end?: boolean
  badge?: number
}

interface TabNavProps {
  items: TabNavItem[]
  className?: string
}

// Tabs (Phase 1) switches content that already all sits on the page;
// this switches between actual routes -- the run report's own tabs
// (Phase 7) are the first caller, and Phases 11-12 reuse it for the
// Model and Benchmark detail pages' own path-based tabs. Built on
// NavLink rather than Radix's Tabs primitive, since a tab here is real
// navigation (the browser's back button and a pasted URL both need to
// land on the right one), not local component state; NavLink sets
// `aria-current="page"` on the active tab itself, so no extra prop is
// needed for that. Same visual language as Tabs (a border-bottom
// indicator) so the two read as one pattern.
export function TabNav({ items, className }: TabNavProps) {
  return (
    <nav aria-label="Tabs" className={cn('flex gap-1 border-b border-border', className)}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground',
              'hover:text-foreground',
              isActive && 'border-primary text-foreground',
            )
          }
        >
          {item.label}
          {item.badge !== undefined && <Badge tone="neutral">{item.badge}</Badge>}
        </NavLink>
      ))}
    </nav>
  )
}
