import { Suspense, useMemo } from 'react'
import { Link, Outlet, useParams } from 'react-router'
import { useCheckpoint, useCheckpoints } from '../api/queries/checkpoints'
import { useLeaderboard } from '../api/queries/leaderboard'
import { useRuns } from '../api/queries/runs'
import { useStandards } from '../api/queries/standards'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../components/Button/Button.helper'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { ErrorState } from '../components/ErrorState/ErrorState'
import { ModelDetailSkeleton } from '../components/ModelDetailSkeleton/ModelDetailSkeleton'
import { ModelHeader } from '../components/ModelHeader/ModelHeader'
import { PageSkeleton } from '../components/PageSkeleton/PageSkeleton'
import { TabNav } from '../components/TabNav/TabNav'
import { buildLeaderboard } from '../utils/buildLeaderboard'
import { isNotFoundError } from '../utils/isNotFoundError'
import { paths } from '../utils/paths'
import { buildModelPageTabs, type ModelPageContext } from './ModelDetailPage.helper'

// The model page (docs/UI_REDESIGN_PLAN.md §8.11): replaces the old
// checkpoints list's expandable rows with a real page -- a header
// (identity, weights, registration, actions), then tabs for Results,
// Runs, Configuration and Lineage, all sharing this one already-loaded
// checkpoint (plus the catalog it's ranked against) through the outlet
// context (ModelDetailPage.helper.ts's useModelPage). The leaderboard
// board is built once here, exactly as LeaderboardPage itself builds
// it, so no tab ever re-ranks or disagrees with the Leaderboard.
export function ModelDetailPage() {
  const { modelId } = useParams<{ modelId: string }>()
  const id = Number(modelId)

  const checkpoint = useCheckpoint(id)
  const allCheckpoints = useCheckpoints()
  const leaderboard = useLeaderboard()
  const standards = useStandards()
  const runs = useRuns({ checkpoint_id: id }, { enabled: Number.isFinite(id) })

  // The expensive part (ranking every setup) is memoised against the
  // three queries' own data, mirroring LeaderboardPage.tsx's and
  // ModelsPage.tsx's own reasoning. Computed unconditionally, before
  // any of the early returns below, since a hook can't run behind one.
  const board = useMemo(() => {
    if (!allCheckpoints.data || !leaderboard.data || !standards.data) {
      return null
    }
    return buildLeaderboard(leaderboard.data, allCheckpoints.data, standards.data)
  }, [allCheckpoints.data, leaderboard.data, standards.data])

  if (!Number.isFinite(id) || (checkpoint.isError && isNotFoundError(checkpoint.error))) {
    return (
      <EmptyState
        title="Model not found"
        description="It may have been removed, or the link has a typo."
        actions={
          <Link to={paths.models()} className={buttonClassName('primary', BUTTON_LABEL_SIZE.md)}>
            Back to Models
          </Link>
        }
      />
    )
  }

  const isLoading =
    checkpoint.isLoading ||
    allCheckpoints.isLoading ||
    leaderboard.isLoading ||
    standards.isLoading ||
    runs.isLoading
  if (isLoading) {
    return <ModelDetailSkeleton />
  }

  const isError =
    checkpoint.isError || allCheckpoints.isError || leaderboard.isError || standards.isError || runs.isError
  if (isError) {
    return (
      <ErrorState
        message="Could not load this model"
        details={String(checkpoint.error ?? allCheckpoints.error ?? leaderboard.error ?? standards.error ?? runs.error)}
        onRetry={() => {
          checkpoint.refetch()
          allCheckpoints.refetch()
          leaderboard.refetch()
          standards.refetch()
          runs.refetch()
        }}
      />
    )
  }

  if (!checkpoint.data || !allCheckpoints.data || !standards.data || !runs.data || !board) {
    return null
  }

  const context: ModelPageContext = {
    checkpoint: checkpoint.data,
    allCheckpoints: allCheckpoints.data,
    standards: standards.data,
    board,
    runs: runs.data,
  }

  return (
    <div className="space-y-6">
      <ModelHeader
        checkpoint={checkpoint.data}
        allCheckpoints={allCheckpoints.data}
        standards={standards.data}
        board={board}
      />
      <TabNav items={buildModelPageTabs(checkpoint.data.id, runs.data.length)} />
      {/* Each tab is its own lazy chunk (routes.tsx) -- this narrower
          boundary keeps the header and tab strip above on screen while
          only the tab content below shows the fallback. */}
      <Suspense fallback={<PageSkeleton />}>
        <Outlet context={context} />
      </Suspense>
    </div>
  )
}
