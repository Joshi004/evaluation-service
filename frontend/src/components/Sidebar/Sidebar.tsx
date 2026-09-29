import { Gauge, X } from 'lucide-react'
import { NavLink } from 'react-router'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '../../utils/cn'
import { Badge } from '../Badge/Badge'
import { IconButton } from '../IconButton/IconButton'
import { NAV_GROUPS, type NavItem } from '../AppShell/AppShell.helper'

interface SidebarProps {
  isDrawerOpen: boolean
  onCloseDrawer: () => void
  // Keyed by a nav item's own `to` path. Empty until Phase 5 (Compare)
  // and Phase 9 (Runs) wire in real counts -- this is the slot Phase 2
  // reserves for them, not real data.
  badgeCountsByPath?: Record<string, number>
}

// A small Lucide glyph doubles as the brand mark rather than a
// hand-drawn inline SVG -- one icon set (§4.6), no extra asset, and
// `currentColor`-based like every other Lucide icon here, so no raw
// colour value is needed to tint it.
function BrandMark() {
  return (
    <div className="flex items-center gap-2 px-3">
      <Gauge className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
      <span className="truncate text-sm font-semibold text-foreground">Evaluation Service</span>
    </div>
  )
}

function SidebarNavLink({
  item,
  responsive,
  badgeCount,
}: {
  item: NavItem
  responsive: boolean
  badgeCount: number | undefined
}) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
          isActive ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {/* sr-only (not `hidden`) below xl so the rail keeps an accessible
          name for screen readers even though the label isn't drawn. */}
      <span className={cn('truncate', responsive && 'sr-only xl:not-sr-only')}>{item.label}</span>
      {Boolean(badgeCount) && (
        <span className={cn('ml-auto', responsive && 'sr-only xl:not-sr-only')}>
          <Badge tone="info">{badgeCount}</Badge>
        </span>
      )}
    </NavLink>
  )
}

// Shared by the persistent rail/expanded sidebar and the mobile drawer
// -- `responsive` is what tells the two apart: the persistent sidebar's
// labels/headings hide below the xl breakpoint (rail), the drawer's
// never do (it's only ever shown as its own full-width overlay).
function NavGroupList({ responsive, badgeCountsByPath }: { responsive: boolean; badgeCountsByPath: Record<string, number> }) {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-6">
      {NAV_GROUPS.map((group) => (
        <div key={group.heading} className="flex flex-col gap-1">
          <span
            className={cn(
              'px-3 text-xs font-semibold tracking-wide text-subtle-foreground uppercase',
              responsive && 'sr-only xl:not-sr-only',
            )}
          >
            {group.heading}
          </span>
          {group.items.map((item) => (
            <SidebarNavLink key={item.to} item={item} responsive={responsive} badgeCount={badgeCountsByPath[item.to]} />
          ))}
        </div>
      ))}
    </nav>
  )
}

// §4.2's sidebar. Three responsive tiers, purely from Tailwind's stock
// breakpoints (no custom config needed): expanded (>=1280px, icons +
// labels), rail (768-1279px, icons only, hidden below md instead
// entirely), and an off-canvas drawer below 768px -- the only tier
// needing React state, owned by AppShell and passed down here.
export function Sidebar({ isDrawerOpen, onCloseDrawer, badgeCountsByPath = {} }: SidebarProps) {
  return (
    <>
      <aside className="hidden shrink-0 flex-col gap-6 overflow-y-auto border-r border-border bg-card py-4 md:flex md:w-16 xl:w-[232px]">
        <BrandMark />
        <NavGroupList responsive badgeCountsByPath={badgeCountsByPath} />
      </aside>

      <DialogPrimitive.Root open={isDrawerOpen} onOpenChange={(open) => !open && onCloseDrawer()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 md:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col gap-6 overflow-y-auto bg-card py-4 md:hidden">
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <div className="flex items-center justify-between">
              <BrandMark />
              <DialogPrimitive.Close asChild>
                <IconButton aria-label="Close navigation" className="mr-3">
                  <X className="h-5 w-5" />
                </IconButton>
              </DialogPrimitive.Close>
            </div>
            <NavGroupList responsive={false} badgeCountsByPath={badgeCountsByPath} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}
