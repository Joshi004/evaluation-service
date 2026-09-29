import type { ReactNode } from 'react'
import { Menu, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { IconButton } from '../IconButton/IconButton'
import { buttonClassName, BUTTON_LABEL_SIZE } from '../Button/Button.helper'
import { SystemStatus } from '../SystemStatus/SystemStatus'
import { paths } from '../../utils/paths'

interface TopBarProps {
  breadcrumb: ReactNode
  onOpenDrawer: () => void
}

// §4.4.1's top bar: a menu button (opens Sidebar's drawer, only
// rendered below 768px where the persistent sidebar is hidden), the
// breadcrumb slot -- today just the current page's name, resolved
// centrally by AppShell so none of the 13 existing pages need to feed
// it one themselves -- the New evaluation primary action, and
// SystemStatus.
export function TopBar({ breadcrumb, onOpenDrawer }: TopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      <IconButton aria-label="Open navigation" className="md:hidden" onClick={onOpenDrawer}>
        <Menu className="h-5 w-5" />
      </IconButton>

      <div className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{breadcrumb}</div>

      {/* A styled Link, not a Button wrapping a click-navigate handler
          -- this composes Button's own class-generation helper (rather
          than hand-styling a one-off) while still rendering a real <a>,
          so right-click / open-in-new-tab work like any other link. */}
      <Link
        to={paths.newEvaluation()}
        className={buttonClassName('primary', BUTTON_LABEL_SIZE.md, 'shrink-0')}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        New evaluation
      </Link>

      <SystemStatus />
    </header>
  )
}
