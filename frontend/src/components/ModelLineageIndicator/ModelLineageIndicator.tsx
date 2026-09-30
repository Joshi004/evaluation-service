import { Link } from 'react-router'
import type { ModelLineage } from '../../utils/modelLineage'
import { cn } from '../../utils/cn'
import { paths } from '../../utils/paths'
import { Tooltip } from '../Tooltip/Tooltip'

interface ModelLineageIndicatorProps {
  lineage: ModelLineage
  className?: string
}

// "from X" and "N children" (docs/UI_REDESIGN_PLAN.md §8.11), each with
// a tooltip -- the Models list' own glance at lineage; the model page's
// own Lineage tab is where the full parent/child detail and the
// parent-comparison delta table actually live. Renders nothing for a
// model with no parent and no children, the common case today (no
// checkpoint yet names a parent -- the plan's own "Starting point").
export function ModelLineageIndicator({ lineage, className }: ModelLineageIndicatorProps) {
  if (lineage.parent === null && !lineage.parentMissing && lineage.children.length === 0) {
    return null
  }

  return (
    <span className={cn('inline-flex items-center gap-2 text-xs text-muted-foreground', className)}>
      {lineage.parent && (
        <Tooltip content={`Registered from ${lineage.parent.name}`}>
          <Link to={paths.model(lineage.parent.id)} tabIndex={0} className="hover:text-foreground hover:underline">
            from {lineage.parent.name}
          </Link>
        </Tooltip>
      )}
      {lineage.parentMissing && <span>Parent model no longer exists</span>}
      {lineage.children.length > 0 && (
        <Tooltip content={lineage.children.map((child) => child.name).join(', ')}>
          <span tabIndex={0}>
            {lineage.children.length} {lineage.children.length === 1 ? 'child' : 'children'}
          </span>
        </Tooltip>
      )}
    </span>
  )
}
