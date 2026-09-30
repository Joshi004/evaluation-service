// Non-DOM logic for SampleFilters.tsx: the outcome control's fixed
// option list and a subset's display label. Kept out of the component
// body per .cursor/rules/frontend-components.mdc.

import type { DiagnosticsSubset } from '../../api/client'
import type { SampleOutcome } from '../../api/queries/runDiagnostics'

export const OUTCOME_OPTIONS: { value: SampleOutcome; label: string }[] = [
  { value: 'failed', label: 'Failures only' },
  { value: 'passed', label: 'Passed only' },
  { value: 'all', label: 'All samples' },
]

// The subset's own sample count as the option's hint, so a benchmark
// with unevenly sized subsets shows that before a click is needed to
// find out -- e.g. "default" with a hint of "541 samples".
export function subsetOptionHint(subset: DiagnosticsSubset): string {
  return `${subset.n_samples} sample${subset.n_samples === 1 ? '' : 's'}`
}
