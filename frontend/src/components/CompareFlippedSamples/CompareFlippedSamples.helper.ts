// Non-DOM logic for CompareFlippedSamples.tsx: which non-baseline
// run's flips are currently shown, and the counts line above the two
// flip tables.
import type { RunComparison, RunDetail } from '../../api/client'

// Falls back to the first other run whenever the URL's own selection
// (?flips=) is missing or no longer names one of the runs actually
// being compared -- the same "resolve, don't just trust the URL"
// discipline CompareTrayProvider's own revalidation applies.
export function resolveFlipsRunId(requestedRunId: number | null, otherRuns: RunDetail[]): number | null {
  if (otherRuns.length === 0) {
    return null
  }
  if (requestedRunId !== null && otherRuns.some((run) => run.id === requestedRunId)) {
    return requestedRunId
  }
  return otherRuns[0].id
}

export function flipCountsSummaryText(comparison: RunComparison): string {
  return [
    `${comparison.fail_to_pass.length} fail→pass`,
    `${comparison.pass_to_fail.length} pass→fail`,
    `${comparison.unchanged_passed} unchanged passing`,
    `${comparison.unchanged_failed} unchanged failing`,
    `${comparison.overlap.n_shared} shared samples`,
  ].join(' · ')
}
