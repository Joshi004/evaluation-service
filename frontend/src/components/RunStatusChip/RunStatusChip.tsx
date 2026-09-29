import { Badge } from '../Badge/Badge'
import { cn } from '../../utils/cn'
import { runStatusStyle } from './RunStatusChip.helper'

interface RunStatusChipProps {
  status: string
  className?: string
}

// A run's status as an icon-plus-text pill (§4.5: "never colour
// alone") -- replaces StatusBadge everywhere a run's status is shown.
// `motion-safe:` on the spin honours prefers-reduced-motion (§4.5).
export function RunStatusChip({ status, className }: RunStatusChipProps) {
  const { label, tone, icon: Icon, spin } = runStatusStyle(status)

  return (
    <Badge tone={tone} className={cn('gap-1', className)}>
      <Icon className={cn('h-3 w-3', spin && 'motion-safe:animate-spin')} aria-hidden="true" />
      {label}
    </Badge>
  )
}
