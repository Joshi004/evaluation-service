import { Link } from 'react-router'
import { useRuns } from '../api/queries/runs'
import { useStandards } from '../api/queries/standards'
import { Button } from '../components/Button/Button'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../components/Button/Button.helper'
import { CopyLinkButton } from '../components/CopyLinkButton/CopyLinkButton'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { ErrorState } from '../components/ErrorState/ErrorState'
import { PageHeader } from '../components/PageHeader/PageHeader'
import { RunsSkeleton } from '../components/RunsSkeleton/RunsSkeleton'
import { RunsTable } from '../components/RunsTable/RunsTable'
import { RunsToolbar } from '../components/RunsToolbar/RunsToolbar'
import { paths } from '../utils/paths'
import { countActiveRuns } from '../utils/runStatus'
import { useNow } from '../utils/useNow'
import { useUrlState } from '../utils/useUrlState'
import {
  buildBenchmarkFilterOptions,
  buildModelFilterOptions,
  buildSubmittedByFilterOptions,
  countRunsByStatusFilter,
  filterRuns,
  isOnlyActiveStatusFilter,
  resolveRunsView,
  RUNS_URL_DEFAULTS,
  type RunsSincePreset,
  type RunsStatusFilter,
  type RunsUrlParams,
  type RunsViewMode,
} from './RunsPage.helper'

// The page people leave open (docs/UI_REDESIGN_PLAN.md §8.9): what is
// running, what finished with what score, and why a failure failed --
// grouped by batch by default, with status chips, filters and a live
// indicator, all round-tripping through the URL. useRuns itself backs
// off to a 30s poll once nothing in the whole service is active, rather
// than a flat 5s.
export function RunsPage() {
  const runs = useRuns()
  const standards = useStandards()
  const [searchParams, setUrlParams] = useUrlState<RunsUrlParams>(RUNS_URL_DEFAULTS)
  const { filters, viewMode } = resolveRunsView(searchParams)

  const allRuns = runs.data ?? []
  // Ticks every second while anything in the *whole service* is active,
  // not just what the current filters happen to show -- switching a
  // filter shouldn't change whether an already-open page keeps its
  // duration text moving. Otherwise once a minute: a finished run's own
  // duration is fixed by its own finished_at regardless of `now` (see
  // formatDuration), so there is nothing for a faster tick to catch.
  const now = useNow(countActiveRuns(allRuns) > 0 ? 1000 : 60_000)

  const visibleRuns = filterRuns(allRuns, filters, now)
  const statusCounts = countRunsByStatusFilter(allRuns, filters, now)
  const modelOptions = buildModelFilterOptions(allRuns, filters.modelId)
  const benchmarkOptions = buildBenchmarkFilterOptions(allRuns, standards.data ?? [], filters.benchmark)
  const submittedByOptions = buildSubmittedByFilterOptions(allRuns, filters.submittedBy)
  const batchChipLabel =
    filters.batchId === null
      ? null
      : (allRuns.find((run) => run.run_group_id === filters.batchId)?.run_group_name ?? `Batch ${filters.batchId}`)

  function handleStatusChange(status: RunsStatusFilter): void {
    setUrlParams({ status })
  }
  function handleQueryChange(q: string): void {
    setUrlParams({ q })
  }
  function handleModelChange(model: number | null): void {
    setUrlParams({ model })
  }
  function handleBenchmarkChange(benchmark: string | null): void {
    setUrlParams({ benchmark })
  }
  function handleSubmittedByChange(by: string | null): void {
    setUrlParams({ by })
  }
  function handleSinceChange(since: RunsSincePreset): void {
    setUrlParams({ since })
  }
  function handleClearBatch(): void {
    setUrlParams({ batch: null })
  }
  // Resets every filter at once via a single setUrlParams call (not one
  // call per field) -- React Router does not queue multiple
  // setSearchParams calls made within the same tick (useUrlState.ts's
  // own module comment). `view` is deliberately left out: the By
  // batch / Flat list toggle is a lens, not a filter (the same
  // treatment the Leaderboard's own Clear filters gives its lens/mode).
  function handleClearFilters(): void {
    setUrlParams({ status: 'all', model: null, benchmark: null, by: null, since: 'all', q: '', batch: null })
  }
  function handleViewModeChange(view: RunsViewMode): void {
    setUrlParams({ view })
  }

  // A background refetch failing (isRefetchError) keeps the last-good
  // `data` on screen and is LiveIndicator's own job to surface, not
  // this page's -- only a failure with nothing loaded yet blocks the
  // whole view.
  const hasBlockingError = runs.isError && runs.data === undefined

  return (
    <div className="space-y-4">
      <PageHeader title="Runs" description="Everything in flight and recent, grouped by batch." actions={<CopyLinkButton />} />

      {runs.isLoading && <RunsSkeleton />}

      {hasBlockingError && (
        <ErrorState message="Could not load runs" details={String(runs.error)} onRetry={() => runs.refetch()} />
      )}

      {!runs.isLoading && !hasBlockingError && allRuns.length === 0 && (
        <EmptyState
          title="Nothing has run yet"
          description="Submit an evaluation to see its progress and results here."
          actions={
            <Link to={paths.newEvaluation()} className={buttonClassName('primary', BUTTON_LABEL_SIZE.md)}>
              New evaluation
            </Link>
          }
        />
      )}

      {!runs.isLoading && !hasBlockingError && allRuns.length > 0 && (
        <>
          <RunsToolbar
            filters={filters}
            viewMode={viewMode}
            statusCounts={statusCounts}
            modelOptions={modelOptions}
            benchmarkOptions={benchmarkOptions}
            submittedByOptions={submittedByOptions}
            runsQuery={runs}
            batchChipLabel={batchChipLabel}
            onStatusChange={handleStatusChange}
            onQueryChange={handleQueryChange}
            onModelChange={handleModelChange}
            onBenchmarkChange={handleBenchmarkChange}
            onSubmittedByChange={handleSubmittedByChange}
            onSinceChange={handleSinceChange}
            onClearBatch={handleClearBatch}
            onClearFilters={handleClearFilters}
            onViewModeChange={handleViewModeChange}
          />

          {visibleRuns.length === 0 ? (
            <EmptyState
              title={isOnlyActiveStatusFilter(filters) ? 'Nothing is running right now' : 'No runs match these filters'}
              description={
                isOnlyActiveStatusFilter(filters)
                  ? 'Every run has finished, failed or been cancelled.'
                  : 'Try a different search, or clear your filters.'
              }
              actions={
                isOnlyActiveStatusFilter(filters) ? undefined : (
                  <Button variant="secondary" onClick={handleClearFilters}>
                    Clear filters
                  </Button>
                )
              }
            />
          ) : (
            <RunsTable visibleRuns={visibleRuns} allRuns={allRuns} viewMode={viewMode} now={now} />
          )}
        </>
      )}
    </div>
  )
}
