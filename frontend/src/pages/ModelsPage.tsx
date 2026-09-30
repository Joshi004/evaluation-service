import { useMemo } from 'react'
import { Link } from 'react-router'
import { useCheckpoints } from '../api/queries/checkpoints'
import { useLeaderboard } from '../api/queries/leaderboard'
import { useRuns } from '../api/queries/runs'
import { useStandards } from '../api/queries/standards'
import { Button } from '../components/Button/Button'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../components/Button/Button.helper'
import { CopyLinkButton } from '../components/CopyLinkButton/CopyLinkButton'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { ErrorState } from '../components/ErrorState/ErrorState'
import { ModelCard } from '../components/ModelCard/ModelCard'
import { ModelsSkeleton } from '../components/ModelsSkeleton/ModelsSkeleton'
import { ModelsTable } from '../components/ModelsTable/ModelsTable'
import { ModelsToolbar } from '../components/ModelsToolbar/ModelsToolbar'
import { PageHeader } from '../components/PageHeader/PageHeader'
import { buildLeaderboard } from '../utils/buildLeaderboard'
import { familySpellingsHint, groupCheckpointsByFamily } from '../utils/familyGroups'
import { paths } from '../utils/paths'
import { useUrlState } from '../utils/useUrlState'
import {
  buildModelOverview,
  filterCheckpoints,
  MODELS_URL_DEFAULTS,
  resolveModelsView,
  type ModelOverview,
  type ModelsUrlParams,
  type ModelsViewMode,
  type ModelsWeightsFilter,
} from './ModelsPage.helper'

// The registry: every registered model, grouped by family, with a
// glance at its latest results, lineage and run counts. Results and
// ranks come from the exact same buildLeaderboard board the
// Leaderboard itself renders -- ranks are Leaderboard ranks by
// construction, never a second computation that could disagree with
// it.
export function ModelsPage() {
  const checkpoints = useCheckpoints()
  const leaderboard = useLeaderboard()
  const standards = useStandards()
  const runs = useRuns()
  const [searchParams, setUrlParams] = useUrlState<ModelsUrlParams>(MODELS_URL_DEFAULTS)

  const isLoading = checkpoints.isLoading || leaderboard.isLoading || standards.isLoading || runs.isLoading
  const isError = checkpoints.isError || leaderboard.isError || standards.isError || runs.isError

  // The expensive part (ranking every setup) is memoised against the
  // three queries' own data, mirroring LeaderboardPage.tsx's own
  // reasoning -- filtering and building each model's overview below is
  // cheap by comparison at this app's scale, so neither is memoised a
  // second time.
  const board = useMemo(() => {
    if (!checkpoints.data || !leaderboard.data || !standards.data) {
      return null
    }
    return buildLeaderboard(leaderboard.data, checkpoints.data, standards.data)
  }, [checkpoints.data, leaderboard.data, standards.data])

  const view = resolveModelsView(searchParams)
  const allCheckpoints = checkpoints.data ?? []
  const allRuns = runs.data ?? []

  const filteredCheckpoints = filterCheckpoints(allCheckpoints, view)
  const groups = groupCheckpointsByFamily(filteredCheckpoints)
  const overviewByCheckpointId = new Map<number, ModelOverview>(
    board === null
      ? []
      : filteredCheckpoints.map((checkpoint) => [
          checkpoint.id,
          buildModelOverview(checkpoint, board, standards.data ?? [], allCheckpoints, allRuns),
        ]),
  )

  function handleQueryChange(q: string): void {
    setUrlParams({ q })
  }
  function handleFamilyChange(keys: string[]): void {
    setUrlParams({ family: keys })
  }
  function handleWeightsChange(weights: ModelsWeightsFilter): void {
    setUrlParams({ weights })
  }
  function handleViewModeChange(nextView: ModelsViewMode): void {
    setUrlParams({ view: nextView })
  }
  function handleClearFilters(): void {
    setUrlParams({ q: '', family: [], weights: 'all' })
  }
  function handleRetry(): void {
    checkpoints.refetch()
    leaderboard.refetch()
    standards.refetch()
    runs.refetch()
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Models"
        description="Every registered model, grouped by family."
        actions={
          <>
            <Link to={paths.modelRegister()} className={buttonClassName('primary', BUTTON_LABEL_SIZE.md)}>
              Register a model
            </Link>
            <CopyLinkButton />
          </>
        }
      />

      {isLoading && <ModelsSkeleton />}

      {isError && (
        <ErrorState
          message="Could not load models"
          details={String(checkpoints.error ?? leaderboard.error ?? standards.error ?? runs.error)}
          onRetry={handleRetry}
        />
      )}

      {!isLoading && !isError && board && (
        <>
          {allCheckpoints.length === 0 ? (
            <EmptyState
              title="Register a model"
              description="Once a model is registered, it shows up here."
              actions={
                <Link to={paths.modelRegister()} className={buttonClassName('primary', BUTTON_LABEL_SIZE.md)}>
                  Register a model
                </Link>
              }
            />
          ) : (
            <>
              <ModelsToolbar
                view={view}
                familyOptions={board.familyOptions}
                onQueryChange={handleQueryChange}
                onFamilyChange={handleFamilyChange}
                onWeightsChange={handleWeightsChange}
                onViewModeChange={handleViewModeChange}
              />

              {groups.length === 0 ? (
                <EmptyState
                  title="No models match"
                  description="Try a different search, or clear your filters."
                  actions={
                    <Button variant="secondary" onClick={handleClearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : view.view === 'table' ? (
                <ModelsTable
                  groups={groups}
                  overviewByCheckpointId={overviewByCheckpointId}
                  allCheckpoints={allCheckpoints}
                  board={board}
                />
              ) : (
                <div className="space-y-6">
                  {groups.map((group) => {
                    const spellingsHint = familySpellingsHint(group)
                    return (
                      <section key={group.key}>
                        <h2 className="text-sm font-medium text-muted-foreground">
                          {group.label}
                          {spellingsHint && <span className="ml-1.5">({spellingsHint})</span>}
                        </h2>
                        <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {group.checkpoints.map((checkpoint) => {
                            const overview = overviewByCheckpointId.get(checkpoint.id)
                            if (!overview) {
                              return null
                            }
                            return (
                              <ModelCard
                                key={checkpoint.id}
                                overview={overview}
                                allCheckpoints={allCheckpoints}
                                board={board}
                              />
                            )
                          })}
                        </div>
                      </section>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
