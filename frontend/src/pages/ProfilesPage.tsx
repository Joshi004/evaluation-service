import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { useSamplingProfiles } from '../api/queries/samplingProfiles'
import { useServingProfiles } from '../api/queries/servingProfiles'
import { PageHeader } from '../components/PageHeader/PageHeader'
import { PageSkeleton } from '../components/PageSkeleton/PageSkeleton'
import { TabNav } from '../components/TabNav/TabNav'
import { paths } from '../utils/paths'

// The Profiles layout page: replaces the old separate Sampling and
// Serving profile pages with one PageHeader and a Sampling/Serving
// TabNav, each tab's own count read directly off its own catalog
// query. No outlet context, unlike the Model and Benchmark detail
// pages -- neither tab needs anything the other one already fetched,
// so there's nothing to share.
export function ProfilesPage() {
  const samplingProfiles = useSamplingProfiles()
  const servingProfiles = useServingProfiles()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profiles"
        description="Sampling profiles (how a model is asked to speak) and serving profiles (how its model server is started)."
      />
      <TabNav
        items={[
          { to: paths.profilesSampling(), label: 'Sampling', badge: samplingProfiles.data?.length },
          { to: paths.profilesServing(), label: 'Serving', badge: servingProfiles.data?.length },
        ]}
      />
      {/* Each tab is its own lazy chunk (routes.tsx) -- this narrower
          boundary keeps the header and tab strip above on screen while
          only the tab content below shows the fallback. */}
      <Suspense fallback={<PageSkeleton />}>
        <Outlet />
      </Suspense>
    </div>
  )
}
