// A deliberate feature, not a placeholder to feel bad about: when a
// board genuinely has no results yet, this is what "honest" looks
// like -- never a spinner that never resolves, and never a fabricated
// row.
import type { ComponentType, ReactNode, SVGProps } from 'react'
import { Inbox } from 'lucide-react'
import { cn } from '../../utils/cn'

interface EmptyStateProps {
  // Defaults to Inbox -- every caller gets an icon without having to
  // pick one just for the sake of it.
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon = Inbox, title, description, actions, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center',
        className,
      )}
    >
      <Icon className="h-8 w-8 text-subtle-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {actions && <div className="mt-2 flex items-center gap-2">{actions}</div>}
    </div>
  )
}
