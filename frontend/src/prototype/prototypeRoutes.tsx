import { Route } from 'react-router'
import { PrototypeLeaderboard } from './pages/PrototypeLeaderboard'
import { PrototypeCheckpointDetail } from './pages/PrototypeCheckpointDetail'
import { PrototypeSubmit } from './pages/PrototypeSubmit'
import { PrototypeRuns } from './pages/PrototypeRuns'
import { PrototypeCompare } from './pages/PrototypeCompare'
import { PrototypeModelHistory } from './pages/PrototypeModelHistory'

// The 6 screens of the vision-prototype demo narrative (see prototype/README.md),
// nested under PrototypeApp's shell. `react-router`'s `createRoutesFromChildren`
// recurses into `<React.Fragment>` children, so this Fragment of <Route>
// elements can be spread straight into the <Route path="/vision" element={<PrototypeApp/>}>
// block in routes.tsx without routes.tsx needing to know the individual paths.
export const prototypeRouteElements = (
  <>
    <Route index element={<PrototypeLeaderboard />} />
    <Route path="checkpoints/:checkpointId" element={<PrototypeCheckpointDetail />} />
    <Route path="submit" element={<PrototypeSubmit />} />
    <Route path="runs" element={<PrototypeRuns />} />
    <Route path="compare" element={<PrototypeCompare />} />
    <Route path="history" element={<PrototypeModelHistory />} />
  </>
)
