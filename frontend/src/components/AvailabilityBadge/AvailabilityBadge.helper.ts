import type { CheckpointAvailabilityStatus } from '../../api/client'
import type { BadgeTone } from '../Badge/Badge.helper'
import { WEIGHTS_STATUS_LABELS } from '../../utils/labels'

interface AvailabilityStyle {
  label: string
  tone: BadgeTone
}

// Tone only, kept here -- the label itself comes from utils/labels.ts
// so every screen showing weights status uses the same word
// ('Missing', not the old literal 'Unavailable'). A separate map from
// StatusBadge/RunStatusChip's own tones -- feeding 'unavailable'
// through that map would hit its raw-string fallback instead of a
// tone that means something here.
const AVAILABILITY_TONES: Record<CheckpointAvailabilityStatus, BadgeTone> = {
  unknown: 'neutral',
  available: 'success',
  incomplete: 'warning',
  unavailable: 'danger',
}

export function availabilityStyle(status: CheckpointAvailabilityStatus): AvailabilityStyle {
  return { label: WEIGHTS_STATUS_LABELS[status], tone: AVAILABILITY_TONES[status] }
}
