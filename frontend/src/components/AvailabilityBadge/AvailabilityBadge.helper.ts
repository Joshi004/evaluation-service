// Maps each of the four checkpoint availability states (the
// CheckConstraint in app/models/checkpoint.py) to a label and a
// Tailwind colour pair, in one place, so every page showing
// availability renders it identically. A separate map from
// StatusBadge.helper.ts's eval_run statuses -- feeding 'unavailable'
// through that map would hit its raw-string fallback instead of a
// colour that means something here.
import type { CheckpointAvailabilityStatus } from '../../api/client'

interface AvailabilityStyle {
  label: string
  className: string
}

// 'unknown' is a legitimate state for a checkpoint nobody has checked
// yet (R-T28), not a failure -- it gets the same neutral slate as
// StatusBadge's own fallback, not red.
const AVAILABILITY_STYLES: Record<CheckpointAvailabilityStatus, AvailabilityStyle> = {
  unknown: { label: 'Not checked', className: 'bg-slate-700/60 text-slate-300' },
  available: { label: 'Available', className: 'bg-emerald-500/20 text-emerald-300' },
  incomplete: { label: 'Incomplete', className: 'bg-amber-500/20 text-amber-300' },
  unavailable: { label: 'Unavailable', className: 'bg-red-500/20 text-red-300' },
}

export function availabilityStyle(status: CheckpointAvailabilityStatus): AvailabilityStyle {
  return AVAILABILITY_STYLES[status]
}
