// Non-DOM logic for RunHealthChips.tsx: the ok/warn severity, text and
// tooltip for each of the four chips. Kept out of the component body
// per .cursor/rules/frontend-components.mdc.

import type { LatencySeconds } from '../../api/client'

export type ChipTone = 'success' | 'warning'

export interface HealthChip {
  tone: ChipTone
  text: string
  tooltip: string
}

export function truncatedChip(truncationRate: number): HealthChip {
  const isOk = truncationRate === 0
  return {
    tone: isOk ? 'success' : 'warning',
    text: isOk ? 'Not truncated' : `${(truncationRate * 100).toFixed(1)}% truncated`,
    tooltip:
      'Answers cut off at the token limit before the model finished -- a mechanical failure, not necessarily the model getting the answer wrong.',
  }
}

export function emptyAnswersChip(emptyAnswers: number): HealthChip {
  const isOk = emptyAnswers === 0
  return {
    tone: isOk ? 'success' : 'warning',
    text: isOk ? 'No empty answers' : `${emptyAnswers} empty answer${emptyAnswers === 1 ? '' : 's'}`,
    tooltip: 'The model returned no text at all for these samples.',
  }
}

export function erroredRequestsChip(erroredRequests: number): HealthChip {
  const isOk = erroredRequests === 0
  return {
    tone: isOk ? 'success' : 'warning',
    text: isOk ? 'No errored requests' : `${erroredRequests} errored request${erroredRequests === 1 ? '' : 's'}`,
    tooltip: 'The request to the model server failed outright and produced no answer to score.',
  }
}

// Warns once the slowest requests take at least this many times the
// median -- run 13's own ~5.2x spread is an example of what should
// trip this.
const LATENCY_SPREAD_WARNING_RATIO = 3

export function latencySpreadChip(latency: LatencySeconds): HealthChip | null {
  // A zero median would make the ratio meaningless (and is not a value
  // the harness actually produces) -- rather than showing "Infinityx",
  // the chip is simply omitted.
  if (latency.p50 <= 0) {
    return null
  }
  const ratio = latency.p99 / latency.p50
  const isOk = ratio < LATENCY_SPREAD_WARNING_RATIO
  return {
    tone: isOk ? 'success' : 'warning',
    text: isOk ? 'Consistent latency' : `Slowest requests ${Math.round(ratio)}\u00d7 the median`,
    tooltip:
      'Median vs. slowest (p99) request latency. A wide spread often means a few requests hit a cold start or queued behind others.',
  }
}
