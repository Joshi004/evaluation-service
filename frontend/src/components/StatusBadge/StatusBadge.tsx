import { Badge } from '../Badge/Badge'
import { statusStyle } from './StatusBadge.helper'

interface StatusBadgeProps {
  status: string
}

// One eval_run's status as a coloured pill -- used on both the Runs
// list and the run detail page so a status always looks the same.
export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, tone } = statusStyle(status)

  return <Badge tone={tone}>{label}</Badge>
}
