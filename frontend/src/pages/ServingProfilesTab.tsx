import { useCheckpoints } from '../api/queries/checkpoints'
import { useServingProfiles } from '../api/queries/servingProfiles'
import { CatalogHealthBanner } from '../components/CatalogHealthBanner/CatalogHealthBanner'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { ErrorState } from '../components/ErrorState/ErrorState'
import { ManageCatalogButton } from '../components/ManageCatalogButton/ManageCatalogButton'
import { ProfileDetailPanel } from '../components/ProfileDetailPanel/ProfileDetailPanel'
import { ProfilesSkeleton } from '../components/ProfilesSkeleton/ProfilesSkeleton'
import { ProfilesTable, type ProfileTableRow } from '../components/ProfilesTable/ProfilesTable'
import { CATALOG_RESOURCES } from '../utils/catalogResources'
import { readNumberParam, useUrlState, type UrlParamValue } from '../utils/useUrlState'
import { buildServingProfileRows, formatUsedBy } from './ProfilesPage.helper'

interface ServingProfilesUrlParams {
  [key: string]: UrlParamValue
  profile: number | null
}

const SERVING_PROFILES_URL_DEFAULTS: ServingProfilesUrlParams = { profile: null }

// The Serving tab of /profiles: every serving profile, its own catalog
// toolbar and banner, and the ?profile=-driven detail drawer. No run
// count here -- RunListItem carries no serving profile field.
export function ServingProfilesTab() {
  const profiles = useServingProfiles()
  const checkpoints = useCheckpoints()

  const [searchParams, setUrlParams] = useUrlState<ServingProfilesUrlParams>(SERVING_PROFILES_URL_DEFAULTS)
  const selectedProfileId = readNumberParam(searchParams, 'profile')

  function handleSelectProfile(id: number): void {
    setUrlParams({ profile: id })
  }

  function handleDrawerOpenChange(open: boolean): void {
    if (!open) {
      setUrlParams({ profile: null })
    }
  }

  const isLoading = profiles.isLoading || checkpoints.isLoading
  if (isLoading) {
    return <ProfilesSkeleton />
  }

  const isError = profiles.isError || checkpoints.isError
  if (isError) {
    return (
      <ErrorState
        message="Could not load serving profiles"
        details={String(profiles.error ?? checkpoints.error)}
        onRetry={() => {
          profiles.refetch()
          checkpoints.refetch()
        }}
      />
    )
  }

  if (!profiles.data || !checkpoints.data) {
    return null
  }

  const rows = buildServingProfileRows(profiles.data, checkpoints.data)
  const tableRows: ProfileTableRow[] = rows.map((row) => ({
    id: row.profile.id,
    hash: row.profile.hash,
    name: row.name,
    summary: row.summary,
    usedBy: formatUsedBy(row.usedByModelsCount),
  }))
  const selectedRow = rows.find((row) => row.profile.id === selectedProfileId)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {profiles.data.length} serving profile{profiles.data.length === 1 ? '' : 's'}
        </p>
        <ManageCatalogButton resource={CATALOG_RESOURCES.servingProfiles} />
      </div>

      <CatalogHealthBanner resource={CATALOG_RESOURCES.servingProfiles} />

      {tableRows.length === 0 ? (
        <EmptyState
          title="No serving profiles loaded yet"
          description="Add a serving profile YAML file to the catalog, then reload it."
          actions={<ManageCatalogButton resource={CATALOG_RESOURCES.servingProfiles} />}
        />
      ) : (
        <ProfilesTable rows={tableRows} onSelectProfile={handleSelectProfile} />
      )}

      {selectedRow && (
        <ProfileDetailPanel
          open
          onOpenChange={handleDrawerOpenChange}
          kind="serving"
          profile={selectedRow.profile}
          defaultForModels={checkpoints.data.filter(
            (checkpoint) => checkpoint.default_serving_profile_id === selectedRow.profile.id,
          )}
        />
      )}
    </div>
  )
}
