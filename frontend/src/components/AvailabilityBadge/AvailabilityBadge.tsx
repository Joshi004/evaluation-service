import type { CheckpointAvailabilityStatus } from '../../api/client'
import { Badge } from '../Badge/Badge'
import { availabilityStyle } from './AvailabilityBadge.helper'

interface AvailabilityBadgeProps {
  status: CheckpointAvailabilityStatus
}

// A checkpoint's availability as a coloured pill -- the checkpoints
// page and the Submit grid both need it to look identical, built on
// the same Badge primitive StatusBadge uses, so the app has one
// visual language for state.
export function AvailabilityBadge({ status }: AvailabilityBadgeProps) {
  const { label, tone } = availabilityStyle(status)

  return <Badge tone={tone}>{label}</Badge>
}
