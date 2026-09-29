import type { BadgeTone } from '../Badge/Badge.helper'

// Maps each of the five eval_run statuses (the CheckConstraint in
// app/models/eval_run.py) to a label and a Badge tone, in one place, so
// every page showing a run's status renders it identically.

interface StatusStyle {
  label: string
  tone: BadgeTone
}

const STATUS_STYLES: Record<string, StatusStyle> = {
  queued: { label: 'Queued', tone: 'neutral' },
  running: { label: 'Running', tone: 'info' },
  done: { label: 'Done', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'warning' },
}

const FALLBACK_STYLE: StatusStyle = {
  label: '',
  tone: 'neutral',
}

// Falls back to the raw string rather than throwing -- a status value
// this frontend doesn't recognise yet should still render as something
// readable, not break the page.
export function statusStyle(status: string): StatusStyle {
  return STATUS_STYLES[status] ?? { ...FALLBACK_STYLE, label: status }
}
