import { useCheckpoints } from '../api/queries/checkpoints'
import { useRuns } from '../api/queries/runs'
import { useSamplingProfiles } from '../api/queries/samplingProfiles'
import { CatalogHealthBanner } from '../components/CatalogHealthBanner/CatalogHealthBanner'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { ErrorState } from '../components/ErrorState/ErrorState'
import { ManageCatalogButton } from '../components/ManageCatalogButton/ManageCatalogButton'
import { ProfileDetailPanel } from '../components/ProfileDetailPanel/ProfileDetailPanel'
import { ProfilesSkeleton } from '../components/ProfilesSkeleton/ProfilesSkeleton'
import { ProfilesTable, type ProfileTableRow } from '../components/ProfilesTable/ProfilesTable'
import { CATALOG_RESOURCES } from '../utils/catalogResources'
import { readNumberParam, useUrlState, type UrlParamValue } from '../utils/useUrlState'
import { buildSamplingProfileRows, formatUsedBy } from './ProfilesPage.helper'

interface SamplingProfilesUrlParams {
  [key: string]: UrlParamValue
  profile: number | null
}

const SAMPLING_PROFILES_URL_DEFAULTS: SamplingProfilesUrlParams = { profile: null }

// The Sampling tab of /profiles: every sampling profile, its own
// catalog toolbar and banner, and the ?profile=-driven detail drawer.
export function SamplingProfilesTab() {
  const profiles = useSamplingProfiles()
  const checkpoints = useCheckpoints()
  // Unfiltered -- shares its cache with the sidebar's own Runs badge,
  // so counting by sampling_profile_hash here adds no request.
  const runs = useRuns()

  const [searchParams, setUrlParams] = useUrlState<SamplingProfilesUrlParams>(SAMPLING_PROFILES_URL_DEFAULTS)
  const selectedProfileId = readNumberParam(searchParams, 'profile')

  function handleSelectProfile(id: number): void {
    setUrlParams({ profile: id })
  }

  function handleDrawerOpenChange(open: boolean): void {
    if (!open) {
      setUrlParams({ profile: null })
    }
  }

  const isLoading = profiles.isLoading || checkpoints.isLoading || runs.isLoading
  if (isLoading) {
    return <ProfilesSkeleton />
  }

  const isError = profiles.isError || checkpoints.isError || runs.isError
  if (isError) {
    return (
      <ErrorState
        message="Could not load sampling profiles"
        details={String(profiles.error ?? checkpoints.error ?? runs.error)}
        onRetry={() => {
          profiles.refetch()
          checkpoints.refetch()
          runs.refetch()
        }}
      />
    )
  }

  if (!profiles.data || !checkpoints.data || !runs.data) {
    return null
  }

  const rows = buildSamplingProfileRows(profiles.data, checkpoints.data, runs.data)
  const tableRows: ProfileTableRow[] = rows.map((row) => ({
    id: row.profile.id,
    hash: row.profile.hash,
    name: row.name,
    summary: row.summary,
    usedBy: formatUsedBy(row.usedByModelsCount, row.usedInRunsCount),
  }))
  const selectedRow = rows.find((row) => row.profile.id === selectedProfileId)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {profiles.data.length} sampling profile{profiles.data.length === 1 ? '' : 's'}
        </p>
        <ManageCatalogButton resource={CATALOG_RESOURCES.samplingProfiles} />
      </div>

      <CatalogHealthBanner resource={CATALOG_RESOURCES.samplingProfiles} />

      {tableRows.length === 0 ? (
        <EmptyState
          title="No sampling profiles loaded yet"
          description="Add a sampling profile YAML file to the catalog, then reload it."
          actions={<ManageCatalogButton resource={CATALOG_RESOURCES.samplingProfiles} />}
        />
      ) : (
        <ProfilesTable rows={tableRows} onSelectProfile={handleSelectProfile} />
      )}

      {selectedRow && (
        <ProfileDetailPanel
          open
          onOpenChange={handleDrawerOpenChange}
          kind="sampling"
          profile={selectedRow.profile}
          usedInRunsCount={selectedRow.usedInRunsCount}
          defaultForModels={checkpoints.data.filter(
            (checkpoint) => checkpoint.default_sampling_profile_id === selectedRow.profile.id,
          )}
        />
      )}
    </div>
  )
}
