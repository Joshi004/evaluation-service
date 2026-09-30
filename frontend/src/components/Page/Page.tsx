import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface PageProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

// Page anatomy: PageHeader -> optional tab bar -> content. Neither
// wrapper below enforces a particular child shape. `space-y-6` only
// affects direct children, and every existing page returns a single
// root element, so it has no effect until a future rewrite returns
// multiple top-level sections.
//
// Page is the default: max ~1200px, for forms and text-heavy pages.
// routes.tsx wraps every one of today's routes in this, so all 13 keep
// effectively the width App.tsx's old max-w-6xl (1152px) already gave
// them.
export function Page({ className, children, ...rest }: PageProps) {
  return (
    <div className={cn('mx-auto w-full max-w-[1200px] space-y-6 px-6 py-8', className)} {...rest}>
      {children}
    </div>
  )
}

// The data-table alternative: full width, no horizontal cap. Not wired
// into any route yet -- a future phase (6's leaderboard matrix, 9's runs
// table, ...) swaps its own route's element from Page to this one in
// routes.tsx when it rewrites that page, with no change to AppShell.
export function PageWide({ className, children, ...rest }: PageProps) {
  return (
    <div className={cn('w-full space-y-6 px-6 py-8', className)} {...rest}>
      {children}
    </div>
  )
}
