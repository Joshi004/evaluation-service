// Non-DOM logic for SampleList.tsx: formatting one sample's score and
// its pass/fail badge tone. Kept out of the component body per
// .cursor/rules/frontend-components.mdc -- "data should already be in
// the shape it needs by the time it reaches JSX."
import type { BadgeTone } from '../Badge/Badge.helper'

// The per-sample primary score, read straight out of `scores` by name.
// DiagnosticsSample carries no display hint (only RunDetail's
// MetricPerformance does) -- so this is a plain fixed-precision
// fraction, not a formatted percentage.
export function primaryScoreText(scores: Record<string, number>, primaryMetricName: string): string {
  const value = scores[primaryMetricName]
  return value === undefined ? '\u2014' : value.toFixed(2)
}

export interface OutcomeBadgeStyle {
  label: string
  tone: BadgeTone
}

// A local pass/fail badge rather than RunStatusChip -- that component's
// own helper maps the five eval_run statuses and says so explicitly;
// "pass"/"fail" would just fall through to its neutral fallback instead
// of reading as an outcome. Shared with SamplePanel, so the list's own
// badge and the panel's own header badge never disagree.
export function outcomeBadge(passed: boolean): OutcomeBadgeStyle {
  return passed ? { label: 'Pass', tone: 'success' } : { label: 'Fail', tone: 'danger' }
}

// One shared id format for a row's own Key link, so RunSamplesTab can
// return focus to the right row by id after SamplePanel closes without
// duplicating (and risking drift from) the string this component
// builds for itself.
export function sampleRowLinkId(sampleKey: string): string {
  return `sample-row-${sampleKey}`
}
