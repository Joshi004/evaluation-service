// Non-DOM logic for SampleFilters.tsx: the outcome dropdown's fixed
// option list and a subset's display label. Kept out of the component
// body per .cursor/rules/frontend-components.mdc.

import type { DiagnosticsSubset } from '../../api/client'
import type { SampleOutcome } from '../../pages/RunDiagnosticsPage.helper'

export const OUTCOME_OPTIONS: { value: SampleOutcome; label: string }[] = [
  { value: 'failed', label: 'Failures only' },
  { value: 'passed', label: 'Passed only' },
  { value: 'all', label: 'All samples' },
]

// "default (541)" -- the subset's own sample count, so a benchmark
// with unevenly sized subsets shows that before a click is needed to
// find out.
export function subsetOptionLabel(subset: DiagnosticsSubset): string {
  return `${subset.name} (${subset.n_samples})`
}
