import { Suspense, useMemo } from 'react'
import { Link, Outlet, useParams } from 'react-router'
import { useCheckpoints } from '../api/queries/checkpoints'
import { useLeaderboard } from '../api/queries/leaderboard'
import { useRuns } from '../api/queries/runs'
import { useStandards } from '../api/queries/standards'
import { BenchmarkDetailSkeleton } from '../components/BenchmarkDetailSkeleton/BenchmarkDetailSkeleton'
import { BenchmarkHeader } from '../components/BenchmarkHeader/BenchmarkHeader'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../components/Button/Button.helper'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { ErrorState } from '../components/ErrorState/ErrorState'
import { PageSkeleton } from '../components/PageSkeleton/PageSkeleton'
import { TabNav } from '../components/TabNav/TabNav'
import { buildLeaderboard } from '../utils/buildLeaderboard'
import { paths } from '../utils/paths'
import { buildBenchmarkPageTabs, type BenchmarkPageContext } from './BenchmarkDetailPage.helper'

// The Benchmark detail page (Phase 12, docs/UI_REDESIGN_PLAN.md
// §8.12): mirrors ModelDetailPage.tsx's own shape -- a header, then
// tabs for Overview, Protocol and Runs, all sharing this one
// already-loaded standard (plus the board it's ranked in) through the
// outlet context (BenchmarkDetailPage.helper.ts's useBenchmarkPage).
// Decision #1: the URL id is the standard id, not the benchmark slug --
// each versioned standard gets its own page, matching the New
// evaluation picker's own "one card per standard" convention.
export function BenchmarkDetailPage() {
  const { benchmarkId } = useParams<{ benchmarkId: string }>()
  const id = Number(benchmarkId)

  const standards = useStandards()
  const allCheckpoints = useCheckpoints()
  const leaderboard = useLeaderboard()
  const runs = useRuns({ standard_id: id }, { enabled: Number.isFinite(id) })

  // The expensive part (ranking every setup) is memoised against the
  // three queries' own data, mirroring ModelDetailPage.tsx's own
  // reasoning.
  const board = useMemo(() => {
    if (!allCheckpoints.data || !leaderboard.data || !standards.data) {
      return null
    }
    return buildLeaderboard(leaderboard.data, allCheckpoints.data, standards.data)
  }, [allCheckpoints.data, leaderboard.data, standards.data])

  const standard = standards.data?.find((candidate) => candidate.id === id)

  // There is no GET /standards/{id} -- the full list is already what
  // every other Benchmarks/New-evaluation view reads and caches
  // (CATALOG_QUERY_OPTIONS' 5-minute staleTime), so "not found" is
  // read off that same list once it has loaded, rather than a second
  // per-id endpoint this phase would have to add.
  if (!Number.isFinite(id) || (standards.data !== undefined && standard === undefined)) {
    return (
      <EmptyState
        title="Benchmark not found"
        description="It may have been removed, or the link has a typo."
        actions={
          <Link to={paths.benchmarks()} className={buttonClassName('primary', BUTTON_LABEL_SIZE.md)}>
            Back to Benchmarks
          </Link>
        }
      />
    )
  }

  const isLoading = standards.isLoading || allCheckpoints.isLoading || leaderboard.isLoading || runs.isLoading
  if (isLoading) {
    return <BenchmarkDetailSkeleton />
  }

  const isError = standards.isError || allCheckpoints.isError || leaderboard.isError || runs.isError
  if (isError) {
    return (
      <ErrorState
        message="Could not load this benchmark"
        details={String(standards.error ?? allCheckpoints.error ?? leaderboard.error ?? runs.error)}
        onRetry={() => {
          standards.refetch()
          allCheckpoints.refetch()
          leaderboard.refetch()
          runs.refetch()
        }}
      />
    )
  }

  if (!standard || !allCheckpoints.data || !runs.data || !board) {
    return null
  }

  const context: BenchmarkPageContext = {
    standard,
    allCheckpoints: allCheckpoints.data,
    board,
    runs: runs.data,
  }

  return (
    <div className="space-y-6">
      <BenchmarkHeader standard={standard} />
      <TabNav items={buildBenchmarkPageTabs(standard.id, runs.data.length)} />
      {/* Each tab is its own lazy chunk (routes.tsx) -- this narrower
          boundary keeps the header and tab strip above on screen while
          only the tab content below shows the fallback. */}
      <Suspense fallback={<PageSkeleton />}>
        <Outlet context={context} />
      </Suspense>
    </div>
  )
}
