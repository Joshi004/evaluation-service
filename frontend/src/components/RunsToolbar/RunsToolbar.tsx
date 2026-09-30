import type { UseQueryResult } from '@tanstack/react-query'
import { X } from 'lucide-react'
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
import { IconButton } from '../IconButton/IconButton'
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

// §8.9's own toolbar: status chips with their counts and the live
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
          onChange={(event) => onModelChange(event.target.value === '' ? null : Number(event.target.value))}
          aria-label="Model"
          className="w-40"
        >
          <option value="">All models</option>
          {modelOptions.map((option) => (
            <option key={option.checkpointId} value={option.checkpointId}>
              {option.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          value={filters.benchmark ?? ''}
          onChange={(event) => onBenchmarkChange(event.target.value === '' ? null : event.target.value)}
          aria-label="Benchmark"
          className="w-40"
        >
          <option value="">All benchmarks</option>
          {benchmarkOptions.map((option) => (
            <option key={option.benchmark} value={option.benchmark}>
              {option.label}
            </option>
          ))}
        </SelectField>

        <SelectField
          value={filters.submittedBy ?? ''}
          onChange={(event) => onSubmittedByChange(event.target.value === '' ? null : event.target.value)}
          aria-label="Submitted by"
          className="w-40"
        >
          <option value="">Anyone</option>
          {submittedByOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>

        <SelectField
          value={filters.since}
          onChange={(event) => onSinceChange(event.target.value as RunsSincePreset)}
          aria-label="Date"
          className="w-40"
        >
          {SINCE_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>

        {batchChipLabel && (
          <span className="flex items-center gap-2 rounded-md border border-border bg-muted px-2 py-1 text-sm text-foreground">
            Batch: {batchChipLabel}
            <IconButton variant="ghost" size="sm" aria-label="Clear batch filter" onClick={onClearBatch}>
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </IconButton>
          </span>
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
        />
      </div>
    </div>
  )
}
