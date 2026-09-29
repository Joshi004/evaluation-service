import { Route, Routes } from 'react-router'
import { AppShell } from './components/AppShell/AppShell'
import { Page } from './components/Page/Page'
import { RedirectPreservingSearch } from './components/RedirectPreservingSearch/RedirectPreservingSearch'
import { paths } from './utils/paths'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { CheckpointDetailPage } from './pages/CheckpointDetailPage'
import { RegisterCheckpointPage } from './pages/RegisterCheckpointPage'
import { StandardsPage } from './pages/StandardsPage'
import { SamplingProfilesPage } from './pages/SamplingProfilesPage'
import { ServingProfilesPage } from './pages/ServingProfilesPage'
import { SubmitPage } from './pages/SubmitPage'
import { RunsPage } from './pages/RunsPage'
import { RunDetailPage } from './pages/RunDetailPage'
import { RunDiagnosticsPage } from './pages/RunDiagnosticsPage'
import { RunSamplePage } from './pages/RunSamplePage'
import { ComparePage } from './pages/ComparePage'
import { EndpointsPage } from './pages/EndpointsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { StyleguidePage } from './pages/StyleguidePage'
import { PrototypeApp } from './prototype/PrototypeApp'
import { prototypeRouteElements } from './prototype/prototypeRoutes'

// The real pages, nested under AppShell (sidebar + top bar; replaces
// the old flat-nav App component -- docs/UI_REDESIGN_PLAN.md Phase 2).
// Leaderboard is the index route ("/"). Every route below mounts an
// existing page component verbatim -- Phase 2 only moves where each
// one lives, per §4.2's route map; no page body changes here. Each is
// wrapped in Page (not PageWide) so none of them shift width from what
// App.tsx's old max-w-6xl already gave them; a later phase that
// rewrites a page into a wide data table swaps that one route's
// wrapper for PageWide, with no change to AppShell.
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route
          index
          element={
            <Page>
              <LeaderboardPage />
            </Page>
          }
        />

        <Route
          path="models"
          element={
            <Page>
              <CheckpointDetailPage />
            </Page>
          }
        />
        {/*
         * No nav item -- reached only via the "Register checkpoint"
         * button on the models page. Its four steps live in this
         * page's own component state, not further router segments
         * (R-D30): a deep link to step 3 has nothing to render without
         * step 2's server response.
         */}
        <Route
          path="models/register"
          element={
            <Page>
              <RegisterCheckpointPage />
            </Page>
          }
        />

        <Route
          path="benchmarks"
          element={
            <Page>
              <StandardsPage />
            </Page>
          }
        />

        <Route
          path="profiles/sampling"
          element={
            <Page>
              <SamplingProfilesPage />
            </Page>
          }
        />
        <Route
          path="profiles/serving"
          element={
            <Page>
              <ServingProfilesPage />
            </Page>
          }
        />

        <Route
          path="evaluate/new"
          element={
            <Page>
              <SubmitPage />
            </Page>
          }
        />

        <Route
          path="runs"
          element={
            <Page>
              <RunsPage />
            </Page>
          }
        />
        <Route
          path="runs/:runId"
          element={
            <Page>
              <RunDetailPage />
            </Page>
          }
        />
        {/*
         * Layer 4 (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 4):
         * the sample list. Layer 5's sample detail page (Phase 7)
         * lives at the nested route below. Renames to .../samples only
         * in Phase 7 -- unchanged here.
         */}
        <Route
          path="runs/:runId/diagnostics"
          element={
            <Page>
              <RunDiagnosticsPage />
            </Page>
          }
        />
        <Route
          path="runs/:runId/samples/:sampleKey"
          element={
            <Page>
              <RunSamplePage />
            </Page>
          }
        />

        {/*
         * Phase 9 (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md): compare
         * mode, sideways across Layers 2-5. A sibling of the /runs
         * tree rather than nested under it -- it takes two run ids,
         * not one. Query shape (?left=&right= -> ?runs=) changes only
         * in Phase 8 -- unchanged here.
         */}
        <Route
          path="compare"
          element={
            <Page>
              <ComparePage />
            </Page>
          }
        />

        <Route
          path="infrastructure"
          element={
            <Page>
              <EndpointsPage />
            </Page>
          }
        />

        {/*
         * Old URLs from before Phase 2 (§4.2's route map). Redirected
         * rather than broken (decision D9) -- deep links to these are
         * already pasted in Slack. RedirectPreservingSearch keeps any
         * query string; none of these old paths had a sub-path beyond
         * what's listed here.
         */}
        <Route path="checkpoints" element={<RedirectPreservingSearch to={paths.models()} />} />
        <Route path="checkpoints/register" element={<RedirectPreservingSearch to={paths.modelRegister()} />} />
        <Route path="standards" element={<RedirectPreservingSearch to={paths.benchmarks()} />} />
        <Route path="sampling-profiles" element={<RedirectPreservingSearch to={paths.profilesSampling()} />} />
        <Route path="serving-profiles" element={<RedirectPreservingSearch to={paths.profilesServing()} />} />
        <Route path="submit" element={<RedirectPreservingSearch to={paths.newEvaluation()} />} />
        <Route path="endpoints" element={<RedirectPreservingSearch to={paths.infrastructure()} />} />

        <Route
          path="*"
          element={
            <Page>
              <NotFoundPage />
            </Page>
          }
        />
      </Route>

      {/*
       * VISION PROTOTYPE — a fully mocked demo for management buy-in, not
       * part of the real product. A sibling of the route above, not a
       * child of it, so it gets its own shell/nav instead of inheriting
       * the real one. See src/prototype/README.md for what's mocked and
       * exactly how to remove this block and the folder it points to.
       * No nav link to it any more (decision D5) -- still reachable by
       * pasting the URL.
       */}
      <Route path="/vision" element={<PrototypeApp />}>
        {prototypeRouteElements}
      </Route>

      {/*
       * Design-system reference (docs/UI_REDESIGN_PLAN.md Phase 1) --
       * dev-only, so it never ships. A sibling of the real app for the
       * same reason /vision is: it is not one of the real pages and has
       * no reason to inherit AppShell.
       */}
      {import.meta.env.DEV && <Route path="/styleguide" element={<StyleguidePage />} />}
    </Routes>
  )
}
