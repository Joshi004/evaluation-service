import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface PageHeaderProps {
  breadcrumb?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

// The top of every page: an optional breadcrumb, the title stating the
// question this page answers (§3 principle 1), a one-line description,
// and a slot for the page's primary action(s). A tab bar, when a page
// has one, goes directly below this (§4.5's page anatomy).
export function PageHeader({ breadcrumb, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div>
        {breadcrumb && <div className="text-sm text-muted-foreground">{breadcrumb}</div>}
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
