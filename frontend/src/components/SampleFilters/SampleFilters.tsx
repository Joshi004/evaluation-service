import { useEffect, useState } from 'react'
import type { DiagnosticsSubset } from '../../api/client'
import type { SampleListFilters, SampleOutcome } from '../../pages/RunDiagnosticsPage.helper'
import { useDebouncedValue } from '../../utils/useDebouncedValue'
import { OUTCOME_OPTIONS, subsetOptionLabel } from './SampleFilters.helper'

interface SampleFiltersProps {
  filters: SampleListFilters
  subsets: DiagnosticsSubset[]
  onChange: (next: SampleListFilters) => void
}

// Committed 300ms after the user stops typing -- fast enough to feel
// responsive, slow enough that a full word doesn't fire one request per
// keystroke.
const SEARCH_DEBOUNCE_MS = 300

const SELECT_CLASS_NAME = 'rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200'

// Layer 4's filter row (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase
// 4). Filter state lives in the URL, not here (Section 4's "a filtered
// view has to be shareable" requirement) -- every change calls
// `onChange`, and RunDiagnosticsPage is what actually rewrites the URL.
// The only local state is the search box's typed-but-not-yet-committed
// draft, so every keystroke doesn't itself trigger a refetch or a URL
// rewrite.
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

  function handleOutcomeChange(outcome: SampleOutcome) {
    onChange({ ...filters, outcome, offset: 0 })
  }

  function handleSubsetChange(subset: string) {
    onChange({ ...filters, subset: subset === '' ? null : subset, offset: 0 })
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className="mb-1 block text-xs text-slate-500">Outcome</span>
        <select
          value={filters.outcome}
          onChange={(event) => handleOutcomeChange(event.target.value as SampleOutcome)}
          className={SELECT_CLASS_NAME}
        >
          {OUTCOME_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {/* IFEval's single "default" subset shows no control; MMLU-Pro's
          14 do (Phase 4's "hidden when the benchmark has only one"). */}
      {subsets.length > 1 && (
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">Subset</span>
          <select
            value={filters.subset ?? ''}
            onChange={(event) => handleSubsetChange(event.target.value)}
            className={SELECT_CLASS_NAME}
          >
            <option value="">All subsets</option>
            {subsets.map((subset) => (
              <option key={subset.name} value={subset.name}>
                {subsetOptionLabel(subset)}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="text-sm">
        <span className="mb-1 block text-xs text-slate-500">Search</span>
        <input
          type="text"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          placeholder="Search prompt or answer…"
          className="w-64 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-200"
        />
      </label>
    </div>
  )
}
