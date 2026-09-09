import type { CheckpointAvailabilityStatus } from '../../api/client'
import { availabilityStyle } from './AvailabilityBadge.helper'

interface AvailabilityBadgeProps {
  status: CheckpointAvailabilityStatus
}

// A checkpoint's availability as a coloured pill -- the checkpoints
// page and the Submit grid (Phase 8) both need it to look identical,
// built on the same base classes as StatusBadge so the app has one
// visual language for state.
export function AvailabilityBadge({ status }: AvailabilityBadgeProps) {
  const { label, className } = availabilityStyle(status)

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
