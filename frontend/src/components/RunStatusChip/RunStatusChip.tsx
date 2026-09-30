import { Badge } from '../Badge/Badge'
import { cn } from '../../utils/cn'
import { runStatusStyle } from './RunStatusChip.helper'

interface RunStatusChipProps {
  status: string
  className?: string
}

// A run's status as an icon-plus-text pill -- never colour alone --
// replaces StatusBadge everywhere a run's status is shown.
// `motion-safe:` on the spin honours prefers-reduced-motion.
export function RunStatusChip({ status, className }: RunStatusChipProps) {
  const { label, tone, icon: Icon, spin } = runStatusStyle(status)

  return (
    <Badge tone={tone} className={cn('gap-1', className)}>
      <Icon className={cn('h-3 w-3', spin && 'motion-safe:animate-spin')} aria-hidden="true" />
      {label}
    </Badge>
  )
}
