import { Route, Routes } from 'react-router'
import App from './App'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { CheckpointDetailPage } from './pages/CheckpointDetailPage'
import { StandardsPage } from './pages/StandardsPage'
import { SubmitPage } from './pages/SubmitPage'
import { RunsPage } from './pages/RunsPage'
import { RunDetailPage } from './pages/RunDetailPage'
import { EndpointsPage } from './pages/EndpointsPage'
import { PrototypeApp } from './prototype/PrototypeApp'
import { prototypeRouteElements } from './prototype/prototypeRoutes'

// The six pages confirmed by decision D5 (docs/IMPLEMENTATION_PHASES.md),
// nested under the App shell (nav + layout). Leaderboard is the index
// route ("/").
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<App />}>
        <Route index element={<LeaderboardPage />} />
        <Route path="checkpoints" element={<CheckpointDetailPage />} />
        <Route path="standards" element={<StandardsPage />} />
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
