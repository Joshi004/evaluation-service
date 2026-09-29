import type { ComponentType, SVGProps } from 'react'
import { Ban, CircleCheck, CircleX, Clock, LoaderCircle } from 'lucide-react'
import type { BadgeTone } from '../Badge/Badge.helper'
import { RUN_STATUS_LABELS } from '../../utils/labels'

interface RunStatusStyle {
  label: string
  tone: BadgeTone
  icon: ComponentType<SVGProps<SVGSVGElement>>
  spin: boolean
}

// Maps each of the five eval_run statuses (the CheckConstraint in
// app/models/eval_run.py) to a label, a tone and an icon, in one
// place, so every page showing a run's status renders it identically
// -- §4.5's status vocabulary now also carries an icon, never colour
// alone. Replaces the old StatusBadge.helper.ts's tone-only map.
const RUN_STATUS_STYLES: Record<string, Omit<RunStatusStyle, 'label'>> = {
  queued: { tone: 'neutral', icon: Clock, spin: false },
  running: { tone: 'info', icon: LoaderCircle, spin: true },
  done: { tone: 'success', icon: CircleCheck, spin: false },
  failed: { tone: 'danger', icon: CircleX, spin: false },
  cancelled: { tone: 'warning', icon: Ban, spin: false },
}

// Falls back to the raw string rather than throwing -- a status value
// this frontend doesn't recognise yet should still render as something
// readable, not break the page.
export function runStatusStyle(status: string): RunStatusStyle {
  const style = RUN_STATUS_STYLES[status]
  if (style) {
    return { ...style, label: RUN_STATUS_LABELS[status] ?? status }
  }
  return { tone: 'neutral', icon: Clock, spin: false, label: status }
}
