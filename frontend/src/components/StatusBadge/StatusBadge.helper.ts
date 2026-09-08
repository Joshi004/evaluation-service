// Maps each of the five eval_run statuses (the CheckConstraint in
// app/models/eval_run.py) to a label and a Tailwind colour pair, in one
// place, so every page showing a run's status renders it identically.

interface StatusStyle {
  label: string
  className: string
}

const STATUS_STYLES: Record<string, StatusStyle> = {
  queued: { label: 'Queued', className: 'bg-slate-700/60 text-slate-300' },
  running: { label: 'Running', className: 'bg-blue-500/20 text-blue-300' },
  done: { label: 'Done', className: 'bg-emerald-500/20 text-emerald-300' },
  failed: { label: 'Failed', className: 'bg-red-500/20 text-red-300' },
  cancelled: { label: 'Cancelled', className: 'bg-amber-500/20 text-amber-300' },
}

const FALLBACK_STYLE: StatusStyle = {
  label: '',
  className: 'bg-slate-700/60 text-slate-300',
}

// Falls back to the raw string rather than throwing -- a status value
// this frontend doesn't recognise yet should still render as something
// readable, not break the page.
export function statusStyle(status: string): StatusStyle {
  return STATUS_STYLES[status] ?? { ...FALLBACK_STYLE, label: status }
}
