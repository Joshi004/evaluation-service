// Shared plain-data shape for Compare's own N-way join: what one
// non-baseline run's own pairwise comparison looks like once resolved.
// Built once in ComparePage and handed to CompareScoreMatrix,
// ComparisonBucketTable and CompareFlippedSamples as plain data --
// none of them reads a raw UseQueryResult, matching "data should
// already be in the shape it needs by the time it reaches JSX"
// (.cursor/rules/frontend-components.mdc).
import type { UseQueryResult } from '@tanstack/react-query'
import type { RunComparison, RunDetail } from '../api/client'

export type ComparePairStatus = 'loading' | 'error' | 'loaded'

export interface ComparePairState {
  run: RunDetail
  status: ComparePairStatus
  // Set only when status === 'loaded' -- still non-null on a refusal
  // (comparable: false carries its own refusal_reason and overlap), so
  // a caller checks `comparison.comparable`, not a second status flag.
  comparison: RunComparison | null
  errorMessage: string | null
  // This pair's own useQueries result carries its own refetch --
  // retrying one failed pairwise comparison should never have to
  // refetch every other pair alongside it.
  refetch: () => void
}

export function buildComparePairStates(
  otherRuns: RunDetail[],
  comparisonResults: UseQueryResult<RunComparison>[],
): ComparePairState[] {
  return otherRuns.map((run, index) => {
    const result = comparisonResults[index]
    if (result.isError) {
      return { run, status: 'error', comparison: null, errorMessage: String(result.error), refetch: result.refetch }
    }
    if (!result.data) {
      return { run, status: 'loading', comparison: null, errorMessage: null, refetch: result.refetch }
    }
    return { run, status: 'loaded', comparison: result.data, errorMessage: null, refetch: result.refetch }
  })
}
