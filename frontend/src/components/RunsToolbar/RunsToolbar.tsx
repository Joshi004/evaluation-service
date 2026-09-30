import type { UseQueryResult } from '@tanstack/react-query'
import type { RunListItem } from '../../api/client'
import { runsPollIntervalMs } from '../../api/queries/runs'
import {
  hasActiveFilters,
  SINCE_FILTER_OPTIONS,
  type BenchmarkFilterOption,
  type ModelFilterOption,
  type RunsFilters,
  type RunsSincePreset,
  type RunsStatusCounts,
  type RunsStatusFilter,
  type RunsViewMode,
  type SubmittedByFilterOption,
} from '../../pages/RunsPage.helper'
import { Button } from '../Button/Button'
import { FilterChip } from '../FilterChip/FilterChip'
import { RunStatusFilter } from '../RunStatusFilter/RunStatusFilter'
import { LiveIndicator } from '../LiveIndicator/LiveIndicator'
import { SearchInput } from '../SearchInput/SearchInput'
import { SegmentedControl } from '../SegmentedControl/SegmentedControl'
import { SelectField } from '../SelectField/SelectField'

interface RunsToolbarProps {
  filters: RunsFilters
  viewMode: RunsViewMode
  statusCounts: RunsStatusCounts
  modelOptions: ModelFilterOption[]
  benchmarkOptions: BenchmarkFilterOption[]
  submittedByOptions: SubmittedByFilterOption[]
  runsQuery: UseQueryResult<RunListItem[]>
  // Already resolved to a display name by RunsPage (e.g. "if-eval-02"
  // for `?batch=4`) -- this toolbar has no reason to look up a
  // run_group_name of its own from the full run list.
  batchChipLabel: string | null
  onStatusChange: (status: RunsStatusFilter) => void
  onQueryChange: (q: string) => void
  onModelChange: (modelId: number | null) => void
  onBenchmarkChange: (benchmark: string | null) => void
  onSubmittedByChange: (submittedBy: string | null) => void
  onSinceChange: (since: RunsSincePreset) => void
  onClearBatch: () => void
  onClearFilters: () => void
  onViewModeChange: (viewMode: RunsViewMode) => void
}

const VIEW_MODE_OPTIONS = [
  { value: 'batches', label: 'By batch' },
  { value: 'flat', label: 'Flat list' },
]

// The toolbar: status chips with their counts and the live
// indicator on one row, then search, the four dropdown filters, the
// batch chip, Clear filters and the By batch / Flat list toggle on a
// second -- every control here always applies (unlike the Leaderboard's
// own lens-conditional ones), so nothing is hidden based on viewMode.
export function RunsToolbar({
  filters,
  viewMode,
  statusCounts,
  modelOptions,
  benchmarkOptions,
  submittedByOptions,
  runsQuery,
  batchChipLabel,
  onStatusChange,
  onQueryChange,
  onModelChange,
  onBenchmarkChange,
  onSubmittedByChange,
  onSinceChange,
  onClearBatch,
  onClearFilters,
  onViewModeChange,
}: RunsToolbarProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RunStatusFilter value={filters.status} counts={statusCounts} onChange={onStatusChange} />
        <LiveIndicator
          pollIntervalMs={runsPollIntervalMs(runsQuery.data)}
          isRefetchError={runsQuery.isRefetchError}
          lastCheckedAt={runsQuery.dataUpdatedAt || null}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={filters.q}
          onChange={(event) => onQueryChange(event.target.value)}
          onClear={() => onQueryChange('')}
          placeholder="Search batches or models..."
          className="w-64"
          aria-label="Search batches or models"
        />

        <SelectField
          value={filters.modelId === null ? '' : String(filters.modelId)}
          onValueChange={(value) => onModelChange(value === '' ? null : Number(value))}
          groups={[
            {
              options: [
                { value: '', label: 'All models' },
                ...modelOptions.map((option) => ({ value: String(option.checkpointId), label: option.name })),
              ],
            },
          ]}
          aria-label="Model"
          className="w-40"
        />

        <SelectField
          value={filters.benchmark ?? ''}
          onValueChange={(value) => onBenchmarkChange(value === '' ? null : value)}
          groups={[
            {
              options: [
                { value: '', label: 'All benchmarks' },
                ...benchmarkOptions.map((option) => ({ value: option.benchmark, label: option.label })),
              ],
            },
          ]}
          aria-label="Benchmark"
          className="w-40"
        />

        <SelectField
          value={filters.submittedBy ?? ''}
          onValueChange={(value) => onSubmittedByChange(value === '' ? null : value)}
          groups={[
            {
              options: [{ value: '', label: 'Anyone' }, ...submittedByOptions],
            },
          ]}
          aria-label="Submitted by"
          className="w-40"
        />

        <SelectField
          value={filters.since}
          onValueChange={(value) => onSinceChange(value as RunsSincePreset)}
          groups={[{ options: SINCE_FILTER_OPTIONS }]}
          aria-label="Date"
          className="w-40"
        />

        {batchChipLabel && (
          <FilterChip label="Batch" value={batchChipLabel} onClear={onClearBatch} clearLabel="Clear batch filter" />
        )}

        {hasActiveFilters(filters) && (
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            Clear filters
          </Button>
        )}

        <SegmentedControl
          className="ml-auto"
          value={viewMode}
          onValueChange={(value) => onViewModeChange(value as RunsViewMode)}
          options={VIEW_MODE_OPTIONS}
          aria-label="View"
        />
      </div>
    </div>
  )
}
