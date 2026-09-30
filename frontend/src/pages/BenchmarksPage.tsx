import { useMemo } from 'react'
import { useLeaderboard } from '../api/queries/leaderboard'
import { useStandards } from '../api/queries/standards'
import { BenchmarkCard } from '../components/BenchmarkCard/BenchmarkCard'
import { BenchmarksSkeleton } from '../components/BenchmarksSkeleton/BenchmarksSkeleton'
import { CatalogHealthBanner } from '../components/CatalogHealthBanner/CatalogHealthBanner'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { ErrorState } from '../components/ErrorState/ErrorState'
import { ManageCatalogButton } from '../components/ManageCatalogButton/ManageCatalogButton'
import { PageHeader } from '../components/PageHeader/PageHeader'
import { CATALOG_RESOURCES } from '../utils/catalogResources'
import { groupStandardsByCategory } from '../utils/standardCategoryGroups'
import { buildBenchmarkCardStatsByStandardId } from './BenchmarksPage.helper'

// The Benchmarks list: every reviewed benchmark, grouped by category,
// each card linking straight to its own detail page instead of this
// page trying to show every field for every benchmark at once.
export function BenchmarksPage() {
  const standards = useStandards()
  const leaderboard = useLeaderboard()

  const isLoading = standards.isLoading || leaderboard.isLoading
  const isError = standards.isError || leaderboard.isError

  const statsByStandardId = useMemo(
    () => buildBenchmarkCardStatsByStandardId(leaderboard.data ?? []),
    [leaderboard.data],
  )
  const groups = useMemo(() => groupStandardsByCategory(standards.data ?? []), [standards.data])

  function handleRetry(): void {
    standards.refetch()
    leaderboard.refetch()
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Benchmarks"
        description="Every reviewed benchmark protocol: what it measures, how it's scored, and who's been run against it."
        actions={<ManageCatalogButton resource={CATALOG_RESOURCES.standards} />}
      />

      <CatalogHealthBanner resource={CATALOG_RESOURCES.standards} />

      {isLoading && <BenchmarksSkeleton />}

      {isError && (
        <ErrorState
          message="Could not load benchmarks"
          details={String(standards.error ?? leaderboard.error)}
          onRetry={handleRetry}
        />
      )}

      {!isLoading && !isError && standards.data && standards.data.length === 0 && (
        <EmptyState
          title="No benchmarks loaded yet"
          description="Add a benchmark YAML file to catalog/standards/, then reload the catalog."
          actions={<ManageCatalogButton resource={CATALOG_RESOURCES.standards} />}
        />
      )}

      {!isLoading && !isError && groups.length > 0 && (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.category ?? 'uncategorised'} className="space-y-2">
              <h2 className="text-xs font-medium text-muted-foreground">{group.category ?? 'Other'}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.standards.map((standard) => (
                  <BenchmarkCard key={standard.id} standard={standard} stats={statsByStandardId.get(standard.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
