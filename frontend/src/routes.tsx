import { Route, Routes } from 'react-router'
import { AppShell } from './components/AppShell/AppShell'
import { Page, PageWide } from './components/Page/Page'
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
import { RunReportPage } from './pages/RunReportPage'
import { RunOverviewTab } from './pages/RunOverviewTab'
import { RunSamplesTab } from './pages/RunSamplesTab'
import { RunConfigTab } from './pages/RunConfigTab'
import { RunLogsTab } from './pages/RunLogsTab'
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
// one lives, per §4.2's route map; no page body changes here, except
// where a later phase's own spec says otherwise (Phase 6 rewrites the
// Leaderboard into a wide data table, so that one route now wraps in
// PageWide instead). A later phase that rewrites a page the same way
// swaps that one route's wrapper, with no change to AppShell.
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route
          index
          element={
            <PageWide>
              <LeaderboardPage />
            </PageWide>
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
        {/*
         * Temporary (Phase 6, docs/UI_REDESIGN_PLAN.md §8.6): the
         * Leaderboard's row header and "Run history" links already
         * point at paths.model(id), a page Phase 11 has not built yet.
         * Redirecting its whole subtree to the models list keeps those
         * links from 404ing in the meantime; Phase 11 replaces this
         * with the real ModelDetailPage route.
         */}
        <Route path="models/:modelId/*" element={<RedirectPreservingSearch to={paths.models()} />} />

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
        {/*
         * The run report (Phase 7, docs/UI_REDESIGN_PLAN.md §8.7):
         * RunReportPage owns the header, the verdict band (done runs
         * only) and the tab strip; each child route below is one tab,
         * rendered into RunReportPage's own <Outlet> and reading the
         * already-loaded run through its outlet context
         * (RunReportPage.helper.ts's useRunReport). Both Samples routes
         * mount the same RunSamplesTab, which reads its own optional
         * :sampleKey -- there is no nested outlet for the sample panel,
         * since it is plain content inside that one tab, not a route of
         * its own. PageWide, not Page: the Samples tab's list-plus-panel
         * view needs the full width once a sample is open.
         */}
        <Route
          path="runs/:runId"
          element={
            <PageWide>
              <RunReportPage />
            </PageWide>
          }
        >
          <Route index element={<RunOverviewTab />} />
          <Route path="samples" element={<RunSamplesTab />} />
          <Route path="samples/:sampleKey" element={<RunSamplesTab />} />
          <Route path="config" element={<RunConfigTab />} />
          <Route path="logs" element={<RunLogsTab />} />
        </Route>
        {/*
         * Old URL from before Phase 7 renamed this tab to .../samples,
         * keeping the same query params (outcome, subset, rule, tag, q,
         * offset -- Appendix A, frozen). A sibling of the report route
         * above, not nested under it -- its only job is to redirect,
         * never to render inside RunReportPage's own frame.
         */}
        <Route
          path="runs/:runId/diagnostics"
          element={<RedirectPreservingSearch to={(params) => paths.runSamples(params.runId ?? '')} />}
        />

        {/*
         * Compare (Phase 8, docs/UI_REDESIGN_PLAN.md §8.8): a sibling
         * of the /runs tree rather than nested under it -- it takes
         * 2-4 run ids via ?runs=, not one. PageWide, not Page: the
         * score matrix's forest plot and the setup-diff table both
         * need the full width, the same reasoning the run report's
         * own route already applies to its Samples tab.
         */}
        <Route
          path="compare"
          element={
            <PageWide>
              <ComparePage />
            </PageWide>
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
