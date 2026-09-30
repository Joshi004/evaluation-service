import { useEffect, useState } from 'react'
import type { DiagnosticsSubset } from '../../api/client'
import type { SampleListFilters, SampleOutcome } from '../../api/queries/runDiagnostics'
import { useDebouncedValue } from '../../utils/useDebouncedValue'
import { FilterChip } from '../FilterChip/FilterChip'
import { SearchInput } from '../SearchInput/SearchInput'
import { SegmentedControl } from '../SegmentedControl/SegmentedControl'
import { SelectField } from '../SelectField/SelectField'
import { OUTCOME_OPTIONS, subsetOptionHint } from './SampleFilters.helper'

interface SampleFiltersProps {
  filters: SampleListFilters
  subsets: DiagnosticsSubset[]
  onChange: (next: SampleListFilters) => void
}

// Committed 300ms after the user stops typing -- fast enough to feel
// responsive, slow enough that a full word doesn't fire one request per
// keystroke.
const SEARCH_DEBOUNCE_MS = 300

// Filter state lives in the URL, not here -- a filtered view has to be
// shareable, so every change calls `onChange`, and RunSamplesTab is
// what actually rewrites the URL. The only local state is the search
// box's typed-but-not-yet-committed draft, so every keystroke doesn't
// itself trigger a refetch or a URL rewrite. The active rule (set by
// clicking a row in FailureBreakdown, or by following a link from the
// Overview tab's own breakdown preview) shows here as its own
// removable pill, now that FailureBreakdown's matching in-place notice
// is collapsed by default.
export function SampleFilters({ filters, subsets, onChange }: SampleFiltersProps) {
  const [syncedQuery, setSyncedQuery] = useState(filters.q)
  const [searchDraft, setSearchDraft] = useState(filters.q)
  const debouncedSearch = useDebouncedValue(searchDraft, SEARCH_DEBOUNCE_MS)

  // Resets the draft when `filters.q` changes for a reason other than
  // this component's own debounced commit below -- the back button, or
  // a filter cleared elsewhere. Comparing against `syncedQuery` (not
  // `searchDraft`) is what tells the two apart: this component's own
  // commit always leaves `searchDraft` already equal to what it just
  // sent, so it's a no-op here in that case. Adjusted during render,
  // per React's own guidance for resetting state from a changed prop,
  // rather than in an effect that would fire an extra render after the
  // fact.
  if (filters.q !== syncedQuery) {
    setSyncedQuery(filters.q)
    setSearchDraft(filters.q)
  }

  // Commits the debounced value once it settles, resetting offset -- a
  // search change must never leave the pager on a page that no longer
  // exists.
  useEffect(() => {
    if (debouncedSearch !== filters.q) {
      onChange({ ...filters, q: debouncedSearch, offset: 0 })
    }
    // Only `debouncedSearch` should retrigger the commit -- depending on
    // `filters`/`onChange` too would re-fire this on every offset or
    // outcome change made elsewhere on the page, not just when the
    // search box itself settles.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  function handleOutcomeChange(outcome: string): void {
    onChange({ ...filters, outcome: outcome as SampleOutcome, offset: 0 })
  }

  function handleSubsetChange(subset: string): void {
    onChange({ ...filters, subset: subset === '' ? null : subset, offset: 0 })
  }

  function handleClearRule(): void {
    onChange({ ...filters, rule: null, offset: 0 })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <SegmentedControl
        options={OUTCOME_OPTIONS}
        value={filters.outcome}
        onValueChange={handleOutcomeChange}
        aria-label="Outcome"
      />

      {/* IFEval's single "default" subset shows no control; MMLU-Pro's
          14 do -- hidden when the benchmark has only one. */}
      {subsets.length > 1 && (
        <SelectField
          value={filters.subset ?? ''}
          onValueChange={handleSubsetChange}
          groups={[
            {
              options: [
                { value: '', label: 'All subsets' },
                ...subsets.map((subset) => ({ value: subset.name, label: subset.name, hint: subsetOptionHint(subset) })),
              ],
            },
          ]}
          aria-label="Subset"
          className="w-48"
        />
      )}

      <SearchInput
        value={searchDraft}
        onChange={(event) => setSearchDraft(event.target.value)}
        onClear={() => setSearchDraft('')}
        placeholder="Search prompt or answer…"
        className="w-64"
        aria-label="Search prompt or answer"
      />

      {filters.rule !== null && (
        <FilterChip label="Rule" value={filters.rule} onClear={handleClearRule} clearLabel="Clear rule filter" />
      )}
    </div>
  )
}
