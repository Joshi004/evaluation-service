// Non-DOM logic for RunHealthBand.tsx: turning a RunPerformanceSummary
// into the display-ready strings the band renders. Kept out of the
// component body per .cursor/rules/frontend-components.mdc -- "data
// should already be in the shape it needs by the time it reaches JSX."

import type {
  ConfidenceInterval,
  LatencySeconds,
  MetricDisplay,
  OutputTokens,
  RunPerformanceSummary,
  Throughput,
} from '../../api/client'

// Applies the harness's own display hint (display_multiplier,
// display_precision, display_unit) so a benchmark that reports seconds
// or tokens-per-second renders correctly with no change here -- falling
// back to the plain-percent formatting every score used before this
// hint existed when a metric carries no display hint at all.
export function formatMetricValue(value: number, display: MetricDisplay | null): string {
  if (display === null) {
    return `${(value * 100).toFixed(1)}%`
  }
  const scaled = value * (display.display_multiplier ?? 1)
  return `${scaled.toFixed(display.display_precision)}${display.display_unit ?? ''}`
}

export function formatConfidenceInterval(
  confidenceInterval: ConfidenceInterval | null,
  display: MetricDisplay | null,
): string | null {
  if (confidenceInterval === null) {
    return null
  }
  const lower = formatMetricValue(confidenceInterval.lower, display)
  const upper = formatMetricValue(confidenceInterval.upper, display)
  return `95% CI ${lower}\u2013${upper}`
}

// Compact notation ("1.44M") for a large token total; exact
// comma-grouped notation ("2,661") for anything small enough to read
// digit-by-digit -- matches docs/SCORE_DRILLDOWN_UI_PLAN.md Section 4's
// Layer 2 mock ("1.44M output tokens ... 2,661 mean, 7,468 max").
function formatCompactCount(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(
    value,
  )
}

export interface HealthBandHeadline {
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
export function buildHeadline(performance: RunPerformanceSummary): HealthBandHeadline | null {
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
    metricValueText: formatMetricValue(primaryMetric.value, primaryMetric.display),
    confidenceIntervalText: formatConfidenceInterval(
      primaryMetric.confidence_interval,
      primaryMetric.display,
    ),
  }
}

// "1.44M output tokens · 2,661 mean, 7,468 max · 108.8 tok/s" -- omits
// whichever half is missing rather than rendering a placeholder, and
// returns null (skip the whole "Cost" row) when both are.
export function buildCostText(
  outputTokens: OutputTokens | null,
  throughput: Throughput | null,
): string | null {
  const parts: string[] = []
  if (outputTokens !== null) {
    parts.push(`${formatCompactCount(outputTokens.total)} output tokens`)
    parts.push(
      `${Math.round(outputTokens.mean).toLocaleString()} mean, ` +
        `${Math.round(outputTokens.max).toLocaleString()} max`,
    )
  }
  if (throughput !== null) {
    parts.push(`${throughput.output_tokens_per_second.toFixed(1)} tok/s`)
  }
  return parts.length > 0 ? parts.join(' \u00b7 ') : null
}

// "0.0% truncated · latency 24.5s mean, 19.2s median, 100.4s p99" --
// truncation and latency only (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md
// Phase 1): empty-answer and errored-request counts arrive in a later
// phase, so this must never show a placeholder for either.
export function buildHealthText(
  truncationRate: number | null,
  latencySeconds: LatencySeconds | null,
): string | null {
  const parts: string[] = []
  if (truncationRate !== null) {
    parts.push(`${(truncationRate * 100).toFixed(1)}% truncated`)
  }
  if (latencySeconds !== null) {
    parts.push(
      `latency ${latencySeconds.mean.toFixed(1)}s mean, ` +
        `${latencySeconds.p50.toFixed(1)}s median, ${latencySeconds.p99.toFixed(1)}s p99`,
    )
  }
  return parts.length > 0 ? parts.join(' \u00b7 ') : null
}
