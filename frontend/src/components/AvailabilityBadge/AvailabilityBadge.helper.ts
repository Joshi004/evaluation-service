import type { CheckpointAvailabilityStatus } from '../../api/client'
import type { BadgeTone } from '../Badge/Badge.helper'

// Maps each of the four checkpoint availability states (the
// CheckConstraint in app/models/checkpoint.py) to a label and a Badge
// tone, in one place, so every page showing availability renders it
// identically. A separate map from StatusBadge.helper.ts's eval_run
// statuses -- feeding 'unavailable' through that map would hit its
// raw-string fallback instead of a tone that means something here.

interface AvailabilityStyle {
  label: string
  tone: BadgeTone
}

// 'unknown' is a legitimate state for a checkpoint nobody has checked
// yet (R-T28), not a failure -- it gets the same neutral tone as
// StatusBadge's own fallback, not danger.
const AVAILABILITY_STYLES: Record<CheckpointAvailabilityStatus, AvailabilityStyle> = {
  unknown: { label: 'Not checked', tone: 'neutral' },
  available: { label: 'Available', tone: 'success' },
  incomplete: { label: 'Incomplete', tone: 'warning' },
  unavailable: { label: 'Unavailable', tone: 'danger' },
}

export function availabilityStyle(status: CheckpointAvailabilityStatus): AvailabilityStyle {
  return AVAILABILITY_STYLES[status]
}
