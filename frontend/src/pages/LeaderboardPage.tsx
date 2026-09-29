import { useMemo } from 'react'
import { Download } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { useCheckpoints } from '../api/queries/checkpoints'
import { useLeaderboard } from '../api/queries/leaderboard'
import { useStandards } from '../api/queries/standards'
import { Button } from '../components/Button/Button'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../components/Button/Button.helper'
import { CopyLinkButton } from '../components/CopyLinkButton/CopyLinkButton'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { ErrorState } from '../components/ErrorState/ErrorState'
import { LeaderboardActivityStrip } from '../components/LeaderboardActivityStrip/LeaderboardActivityStrip'
import { LeaderboardBenchmarkTable } from '../components/LeaderboardBenchmarkTable/LeaderboardBenchmarkTable'
import { LeaderboardHowToRead } from '../components/LeaderboardHowToRead/LeaderboardHowToRead'
import { LeaderboardOverviewTable } from '../components/LeaderboardOverviewTable/LeaderboardOverviewTable'
import { LeaderboardSkeleton } from '../components/LeaderboardSkeleton/LeaderboardSkeleton'
import { LeaderboardToolbar } from '../components/LeaderboardToolbar/LeaderboardToolbar'
import { PageHeader } from '../components/PageHeader/PageHeader'
import { buildLeaderboard } from '../utils/buildLeaderboard'
import { downloadTextFile } from '../utils/downloadTextFile'
import { paths } from '../utils/paths'
import {
  applyLeaderboardParamChanges,
  buildBenchmarkFilterGroups,
  buildLeaderboardCsvRows,
  buildLeaderboardCsvText,
  compareModelRowsForSort,
  defaultDirectionForColumn,
  filterModels,
  resolveLeaderboardView,
  setupParamKey,
  type LeaderboardDensity,
  type LeaderboardLens,
  type LeaderboardSetupsMode,
  type SortDirection,
} from './LeaderboardPage.helper'

export function LeaderboardPage() {
  const leaderboard = useLeaderboard()
  const checkpoints = useCheckpoints()
  const standards = useStandards()
  const [searchParams, setSearchParams] = useSearchParams()

  const isLoading = leaderboard.isLoading || checkpoints.isLoading || standards.isLoading
  const isError = leaderboard.isError || checkpoints.isError || standards.isError

  // The expensive part (ranking every setup) is memoised against the
  // three queries' own data -- TanStack Query keeps that reference
  // stable across renders that don't change the underlying data, so
  // this only re-runs when a query actually refetches something new.
  const board = useMemo(() => {
    if (!leaderboard.data || !checkpoints.data || !standards.data) {
      return null
    }
    return buildLeaderboard(leaderboard.data, checkpoints.data, standards.data)
  }, [leaderboard.data, checkpoints.data, standards.data])

  // Cheap by comparison (a handful of array filters over at most a few
  // thousand cells at the plan's own 100x20 scale check) -- resolved
  // directly from the router's own searchParams rather than memoised a
  // second time, since useSearchParams already returns a fresh
  // URLSearchParams each render regardless.
  const view = board ? resolveLeaderboardView(searchParams, board) : null

  function updateParams(changes: Record<string, string | null>): void {
    setSearchParams((previous) => applyLeaderboardParamChanges(previous, changes), { replace: true })
  }

  function handleQueryChange(q: string): void {
    updateParams({ q: q === '' ? null : q })
  }
  function handleFamilyChange(keys: string[]): void {
    updateParams({ family: keys.length === 0 ? null : keys.join(',') })
  }
  function handleBenchChange(benchmarks: string[]): void {
    updateParams({ bench: benchmarks.length === 0 ? null : benchmarks.join(',') })
  }
  function handleModeChange(mode: LeaderboardSetupsMode): void {
    updateParams({ mode: mode === 'like' ? null : mode })
  }
  function handleLensChange(lens: LeaderboardLens): void {
    updateParams({ lens: lens === 'overview' ? null : lens })
  }
  function handleDensityChange(density: LeaderboardDensity): void {
    updateParams({ density: density === 'comfortable' ? null : density })
  }
  function handleHeatToggle(enabled: boolean): void {
    updateParams({ heat: enabled ? null : 'false' })
  }

  // `sort`/`dir` default to a data-dependent computation ("the
  // benchmark with the most results"), unlike every other param here,
  // whose default is a fixed constant -- so once a person has clicked
  // anything, both are written explicitly rather than this handler
  // trying to re-derive whether the result happens to match today's
  // default. A pasted link is then self-contained: it shows exactly
  // what was clicked, not something that depends on the recipient's
  // own data resolving the same default.
  function handleSortChange(next: { sortBenchmark: string; dir: SortDirection }): void {
    updateParams({ sort: next.sortBenchmark, dir: next.dir })
  }

  function handleBenchmarkSelect(benchmark: string): void {
    if (!board) return
    const column = board.columns.find((candidate) => candidate.benchmark === benchmark)
    updateParams({ sort: benchmark, dir: defaultDirectionForColumn(column) })
  }

  function handleSetupChange(benchmark: string, comparisonHash: string): void {
    if (!board) return
    const column = board.columns.find((candidate) => candidate.benchmark === benchmark)
    const isDefault = column?.defaultComparisonHash === comparisonHash
    updateParams({ [setupParamKey(benchmark)]: isDefault ? null : comparisonHash })
  }

  function handleClearFilters(): void {
    updateParams({ q: null, family: null, bench: null })
  }

  function handleExportCsv(): void {
    if (!board || !view) return
    const rows = buildLeaderboardCsvRows(board, view)
    downloadTextFile('leaderboard.csv', buildLeaderboardCsvText(rows))
  }

  function handleRetry(): void {
    leaderboard.refetch()
    checkpoints.refetch()
    standards.refetch()
  }

  const filteredModels = board && view ? filterModels(board.models, view.q, view.familyFilter) : []
  const sortedModelsForOverview =
    view && view.lens === 'overview'
      ? [...filteredModels].sort((a, b) => compareModelRowsForSort(a, b, view.sortColumn, view.setupOverrides, view.dir))
      : filteredModels

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leaderboard"
        description="Latest result per model and setup. Scores are only ranked against the same setup."
        actions={
          <>
            <LeaderboardHowToRead />
            <Button variant="secondary" size="sm" onClick={handleExportCsv} disabled={!board || board.columns.length === 0}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </Button>
            <CopyLinkButton />
          </>
        }
      />

      {isLoading && <LeaderboardSkeleton />}

      {isError && (
        <ErrorState
          message="Could not load the leaderboard"
          details={String(leaderboard.error ?? checkpoints.error ?? standards.error)}
          onRetry={handleRetry}
        />
      )}

      {!isLoading && !isError && board && view && (
        <>
          {board.columns.length === 0 ? (
            <EmptyState
              title="Register a model, then run an evaluation"
              description="Results appear here once a run finishes."
              actions={
                <>
                  <Link to={paths.modelRegister()} className={buttonClassName('primary', BUTTON_LABEL_SIZE.md)}>
                    Register a model
                  </Link>
                  <Link to={paths.newEvaluation()} className={buttonClassName('secondary', BUTTON_LABEL_SIZE.md)}>
                    New evaluation
                  </Link>
                </>
              }
            />
          ) : (
            <>
              <LeaderboardToolbar
                view={view}
                familyOptions={board.familyOptions}
                benchmarkFilterGroups={buildBenchmarkFilterGroups(board.columns)}
                onQueryChange={handleQueryChange}
                onFamilyChange={handleFamilyChange}
                onBenchChange={handleBenchChange}
                onModeChange={handleModeChange}
                onLensChange={handleLensChange}
                onDensityChange={handleDensityChange}
                onHeatToggle={handleHeatToggle}
              />

              <LeaderboardActivityStrip />

              {filteredModels.length === 0 ? (
                <EmptyState
                  title="No models match"
                  description="Try a different search, or clear your filters."
                  actions={
                    <Button variant="secondary" onClick={handleClearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : view.lens === 'overview' ? (
                <LeaderboardOverviewTable
                  columns={view.visibleColumns}
                  models={sortedModelsForOverview}
                  view={view}
                  onSortChange={handleSortChange}
                  onSetupChange={handleSetupChange}
                />
              ) : (
                <LeaderboardBenchmarkTable
                  allColumns={board.columns}
                  filteredModels={filteredModels}
                  view={view}
                  onBenchmarkChange={handleBenchmarkSelect}
                  onSetupChange={handleSetupChange}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
