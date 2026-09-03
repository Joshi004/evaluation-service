import { Route, Routes } from 'react-router'
import App from './App'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { CheckpointDetailPage } from './pages/CheckpointDetailPage'
import { StandardsPage } from './pages/StandardsPage'
import { S3BrowserPage } from './pages/S3BrowserPage'
import { SubmitPage } from './pages/SubmitPage'
import { RunsPage } from './pages/RunsPage'
import { ComparePage } from './pages/ComparePage'
import { EndpointsPage } from './pages/EndpointsPage'
import { ClusterPage } from './pages/ClusterPage'

// The nine pages from EVAL_SERVICE_PLAN.md, Section 13, nested under the
// App shell (nav + layout). Leaderboard is the index route ("/").
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<App />}>
        <Route index element={<LeaderboardPage />} />
        <Route path="checkpoints" element={<CheckpointDetailPage />} />
        <Route path="standards" element={<StandardsPage />} />
        <Route path="s3-browser" element={<S3BrowserPage />} />
        <Route path="submit" element={<SubmitPage />} />
        <Route path="runs" element={<RunsPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="endpoints" element={<EndpointsPage />} />
        <Route path="cluster" element={<ClusterPage />} />
      </Route>
    </Routes>
  )
}
