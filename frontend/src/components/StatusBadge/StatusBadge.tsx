import { statusStyle } from './StatusBadge.helper'

interface StatusBadgeProps {
  status: string
}

// One eval_run's status as a coloured pill -- used on both the Runs
// list and the run detail page so a status always looks the same.
export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, className } = statusStyle(status)

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
