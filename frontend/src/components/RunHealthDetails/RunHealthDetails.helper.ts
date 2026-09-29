// Non-DOM logic for RunHealthDetails.tsx: turning the run's own
// performance summary and the diagnostics file's health counts into
// KeyValueList rows. Kept out of the component body per
// .cursor/rules/frontend-components.mdc.

import type { DiagnosticsHealth, LatencySeconds, OutputTokens, Throughput } from '../../api/client'

export interface HealthDetailRow {
  label: string
  value: string
}

// Empty answers and errored requests only -- truncation is already
// shown above these as a percentage (RunOverviewTab passes the run's
// own truncation_rate straight through), so repeating the diagnostics
// file's raw count here would just be the same fact said twice.
export function healthCountRows(health: DiagnosticsHealth | null): HealthDetailRow[] {
  if (health === null) {
    return []
  }
  return [
    { label: 'Empty answers', value: String(health.empty_answers) },
    { label: 'Errored requests', value: String(health.errored_requests) },
  ]
}

export function latencyRows(latency: LatencySeconds | null): HealthDetailRow[] {
  if (latency === null) {
    return []
  }
  return [
    { label: 'Latency (mean)', value: `${latency.mean.toFixed(1)}s` },
    { label: 'Latency (median)', value: `${latency.p50.toFixed(1)}s` },
    { label: 'Latency (p90)', value: `${latency.p90.toFixed(1)}s` },
    { label: 'Latency (p99)', value: `${latency.p99.toFixed(1)}s` },
    { label: 'Latency (max)', value: `${latency.max.toFixed(1)}s` },
  ]
}

export function tokenRows(tokens: OutputTokens | null): HealthDetailRow[] {
  if (tokens === null) {
    return []
  }
  return [
    { label: 'Output tokens (mean)', value: Math.round(tokens.mean).toLocaleString() },
    { label: 'Output tokens (max)', value: Math.round(tokens.max).toLocaleString() },
    { label: 'Output tokens (total)', value: tokens.total.toLocaleString() },
  ]
}

export function throughputRows(throughput: Throughput | null): HealthDetailRow[] {
  if (throughput === null) {
    return []
  }
  return [
    { label: 'Throughput', value: `${throughput.output_tokens_per_second.toFixed(1)} tok/s` },
    { label: 'Requests per second', value: throughput.requests_per_second.toFixed(3) },
  ]
}
