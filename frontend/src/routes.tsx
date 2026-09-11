import { Route, Routes } from 'react-router'
import App from './App'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { CheckpointDetailPage } from './pages/CheckpointDetailPage'
import { RegisterCheckpointPage } from './pages/RegisterCheckpointPage'
import { StandardsPage } from './pages/StandardsPage'
import { SamplingProfilesPage } from './pages/SamplingProfilesPage'
import { ServingProfilesPage } from './pages/ServingProfilesPage'
import { SubmitPage } from './pages/SubmitPage'
import { RunsPage } from './pages/RunsPage'
import { RunDetailPage } from './pages/RunDetailPage'
import { EndpointsPage } from './pages/EndpointsPage'
import { PrototypeApp } from './prototype/PrototypeApp'
import { prototypeRouteElements } from './prototype/prototypeRoutes'

// The real pages, nested under the App shell (nav + layout). Leaderboard
// is the index route ("/"). Originally "the six pages confirmed by
// decision D5" (docs/IMPLEMENTATION_PHASES.md, a file that was never
// committed -- docs/STANDARDS_AND_PROFILES_PHASES.md Section 0 says not
// to look for it); Phase 7 of that document added the two catalog pages
// below, so the count is stale and not worth restating here.
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<App />}>
        <Route index element={<LeaderboardPage />} />
        <Route path="checkpoints" element={<CheckpointDetailPage />} />
        {/*
         * No nav item -- reached only via the "Register checkpoint"
         * button on the checkpoints page. Its four steps live in this
         * page's own component state, not further router segments
         * (R-D30): a deep link to step 3 has nothing to render without
         * step 2's server response.
         */}
        <Route path="checkpoints/register" element={<RegisterCheckpointPage />} />
        <Route path="standards" element={<StandardsPage />} />
        <Route path="sampling-profiles" element={<SamplingProfilesPage />} />
        <Route path="serving-profiles" element={<ServingProfilesPage />} />
        <Route path="submit" element={<SubmitPage />} />
        <Route path="runs" element={<RunsPage />} />
        <Route path="runs/:runId" element={<RunDetailPage />} />
        <Route path="endpoints" element={<EndpointsPage />} />
      </Route>

      {/*
       * VISION PROTOTYPE — a fully mocked demo for management buy-in, not
       * part of the real product. A sibling of the route above, not a
       * child of it, so it gets its own shell/nav instead of inheriting
       * the real one. See src/prototype/README.md for what's mocked and
       * exactly how to remove this block and the folder it points to.
       */}
      <Route path="/vision" element={<PrototypeApp />}>
        {prototypeRouteElements}
      </Route>
    </Routes>
  )
}
