// Non-DOM logic for CompareScoreMatrix.tsx: reading a run's own
// primary metric (score, interval, pass/fail, display hint) straight
// off its already-loaded RunDetail, and summarising every refused
// pair for the callout below the table.
import type { MetricPerformance, RunDetail } from '../../api/client'
import type { ComparePairState } from '../../utils/compareRuns'

export function primaryMetric(run: RunDetail): MetricPerformance | null {
  return run.performance?.metrics.find((metric) => metric.is_primary) ?? null
}

export interface RefusedPairNote {
  runId: number
  reason: string
  overlapText: string
}

// One row per pair whose comparison actually loaded but was refused
// (comparable: false) -- a still-loading or errored pair has nothing
// to say here yet; its own cell already covers that state.
export function buildRefusalNotes(pairs: ComparePairState[]): RefusedPairNote[] {
  const notes: RefusedPairNote[] = []
  for (const pair of pairs) {
    if (pair.status === 'loaded' && pair.comparison && !pair.comparison.comparable) {
      notes.push({
        runId: pair.run.id,
        reason: pair.comparison.refusal_reason ?? 'These runs cannot be compared.',
        overlapText: `${pair.comparison.overlap.n_shared} shared samples`,
      })
    }
  }
  return notes
}
