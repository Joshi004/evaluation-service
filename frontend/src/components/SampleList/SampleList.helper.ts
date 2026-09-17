// Non-DOM logic for SampleList.tsx: formatting one sample's score, its
// pass/fail badge, and its preview text. Kept out of the component
// body per .cursor/rules/frontend-components.mdc -- "data should
// already be in the shape it needs by the time it reaches JSX."

// The per-sample primary score, read straight out of `scores` by name.
// DiagnosticsSample carries no display hint (only RunDetail's
// MetricPerformance does, from Phase 1) -- so this is a plain
// fixed-precision fraction, not a formatted percentage.
export function primaryScoreText(scores: Record<string, number>, primaryMetricName: string): string {
  const value = scores[primaryMetricName]
  return value === undefined ? '\u2014' : value.toFixed(2)
}

export interface OutcomeBadgeStyle {
  label: string
  className: string
}

// A local pass/fail badge rather than reusing StatusBadge -- that
// component's own helper maps the five eval_run statuses and says so
// explicitly; "pass"/"fail" would just fall through to its grey
// fallback instead of reading as an outcome.
export function outcomeBadge(passed: boolean): OutcomeBadgeStyle {
  return passed
    ? { label: 'Pass', className: 'bg-emerald-500/20 text-emerald-300' }
    : { label: 'Fail', className: 'bg-red-500/20 text-red-300' }
}
