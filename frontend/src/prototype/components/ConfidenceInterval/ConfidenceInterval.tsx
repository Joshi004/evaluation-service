import { formatHalfWidth, formatValue, type MetricUnit } from './ConfidenceInterval.helper'

interface ConfidenceIntervalProps {
  value: number
  stderr: number
  unit: MetricUnit
}

// A metric shown with its 95% interval, never alone — see
// EVAL_SERVICE_PLAN.md Section 5, "Sample size, and why we should show
// error bars". Two scores a few points apart can be statistically
// indistinguishable, and this is the one place that fact has to be visible.
export function ConfidenceInterval({ value, stderr, unit }: ConfidenceIntervalProps) {
  return (
    <span className="whitespace-nowrap">
      <span className="font-medium text-slate-100">{formatValue(value, unit)}</span>
      <span className="ml-1 text-xs text-slate-500">± {formatHalfWidth(stderr, unit)}</span>
    </span>
  )
}
