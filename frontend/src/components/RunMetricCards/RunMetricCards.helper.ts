// Non-DOM logic for RunMetricCards.tsx: one metric's own display-ready
// strings. Kept out of the component body per
// .cursor/rules/frontend-components.mdc.
import type { MetricPerformance } from '../../api/client'
import { formatMargin, formatScoreWithUnit } from '../../utils/formatScore'

export interface MetricCardData {
  name: string
  displayName: string
  isPrimary: boolean
  valueText: string
  marginText: string | null
  countsText: string | null
}

// Formatted with the run's own display hint (display_kind,
// display_multiplier, display_unit, display_precision) and
// display_name -- never a prettified slug, and never a bare
// percent-with-one-decimal default guess for a metric that carries its
// own hint.
export function buildMetricCardData(metric: MetricPerformance): MetricCardData {
  return {
    name: metric.name,
    displayName: metric.display_name,
    isPrimary: metric.is_primary,
    valueText: formatScoreWithUnit(metric.value, metric.display),
    marginText: formatMargin(metric.confidence_interval, metric.display),
    countsText:
      metric.passed !== null && metric.failed !== null ? `${metric.passed} of ${metric.n_samples} passed` : null,
  }
}
