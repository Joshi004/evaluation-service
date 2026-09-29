// Non-DOM logic for RunVerdictBand.tsx: turning a RunPerformanceSummary
// into the display-ready strings the band renders. Moved from
// RunHealthBand.helper.ts (Phase 7, docs/UI_REDESIGN_PLAN.md §8.7) --
// the headline and confidence-interval formatting are unchanged; the
// cost line is trimmed to total tokens and throughput now that the
// mean/max per-request token figures live in the Overview tab's own
// Health details instead (RunHealthDetails).
//
// Kept out of the component body per
// .cursor/rules/frontend-components.mdc -- "data should already be in
// the shape it needs by the time it reaches JSX."
import type {
  ConfidenceInterval,
  MetricDisplay,
  OutputTokens,
  RunPerformanceSummary,
  Throughput,
} from '../../api/client'
import { formatScoreWithUnit } from '../../utils/formatScore'

export function formatConfidenceInterval(
  confidenceInterval: ConfidenceInterval | null,
  display: MetricDisplay | null,
): string | null {
  if (confidenceInterval === null) {
    return null
  }
  const lower = formatScoreWithUnit(confidenceInterval.lower, display)
  const upper = formatScoreWithUnit(confidenceInterval.upper, display)
  return `95% CI ${lower}\u2013${upper}`
}

// Compact notation ("1.44M") for a large token total -- matches
// docs/SCORE_DRILLDOWN_UI_PLAN.md Section 4's Layer 2 mock ("1.44M
// output tokens").
function formatCompactCount(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(
    value,
  )
}

export interface VerdictHeadline {
  countsText: string | null
  failedText: string | null
  metricLabel: string
  metricValueText: string
  confidenceIntervalText: string | null
}

// The primary metric's line: counts if this run's primary metric is a
// genuine per-sample pass rate (every benchmark in the catalog today),
// falling back to just the metric's value when it isn't --
// MetricPerformance.passed/failed/confidence_interval are only ever set
// on the primary metric (app/schemas/diagnostics.py).
export function buildHeadline(performance: RunPerformanceSummary): VerdictHeadline | null {
  const primaryMetric = performance.metrics.find((metric) => metric.is_primary)
  if (primaryMetric === undefined) {
    return null
  }

  const hasCounts = primaryMetric.passed !== null && primaryMetric.failed !== null
  return {
    countsText: hasCounts
      ? `${primaryMetric.passed} of ${primaryMetric.n_samples} samples passed`
      : null,
    failedText: hasCounts ? `${primaryMetric.failed} failed` : null,
    metricLabel: primaryMetric.display_name,
    metricValueText: formatScoreWithUnit(primaryMetric.value, primaryMetric.display),
    confidenceIntervalText: formatConfidenceInterval(
      primaryMetric.confidence_interval,
      primaryMetric.display,
    ),
  }
}

// "1.44M output tokens · 108.8 tok/s" -- just the run-wide cost; the
// mean/max per-request token figures now live in the Overview tab's own
// Health details (RunHealthDetails). Omits whichever half is missing
// rather than a placeholder, and returns null (skip the row) when both
// are.
export function buildCostText(
  outputTokens: OutputTokens | null,
  throughput: Throughput | null,
): string | null {
  const parts: string[] = []
  if (outputTokens !== null) {
    parts.push(`${formatCompactCount(outputTokens.total)} output tokens`)
  }
  if (throughput !== null) {
    parts.push(`${throughput.output_tokens_per_second.toFixed(1)} tok/s`)
  }
  return parts.length > 0 ? parts.join(' \u00b7 ') : null
}
