// A deliberate feature, not a placeholder to feel bad about: when a
// board genuinely has no results yet, this is what "honest" looks like
// (see docs/IMPLEMENTATION_PHASES.md, Trap T5) -- never a spinner that
// never resolves, and never a fabricated row.
import type { ComponentType, ReactNode, SVGProps } from 'react'
import { cn } from '../../utils/cn'

interface EmptyStateProps {
  // The original, single-sentence shape -- kept working as-is (every
  // page not yet touched by docs/UI_REDESIGN_PLAN.md Phase 6 still
  // calls EmptyState with only this prop). `title` below switches to
  // the richer §4.5 shape ("icon, title, one sentence, one action")
  // instead.
  message?: string
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

export function EmptyState({ message, icon: Icon, title, description, actions, className }: EmptyStateProps) {
  if (title === undefined) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground',
          className,
        )}
      >
        {message}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center',
        className,
      )}
    >
      {Icon && <Icon className="h-8 w-8 text-subtle-foreground" aria-hidden="true" />}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {actions && <div className="mt-2 flex items-center gap-2">{actions}</div>}
    </div>
  )
}
