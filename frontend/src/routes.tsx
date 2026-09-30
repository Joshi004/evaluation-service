import { Route, Routes } from 'react-router'
import { AppShell } from './components/AppShell/AppShell'
import { Page, PageWide } from './components/Page/Page'
import { RedirectPreservingSearch } from './components/RedirectPreservingSearch/RedirectPreservingSearch'
import { paths } from './utils/paths'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { ModelsPage } from './pages/ModelsPage'
import { ModelDetailPage } from './pages/ModelDetailPage'
import { ModelResultsTab } from './pages/ModelResultsTab'
import { ModelRunsTab } from './pages/ModelRunsTab'
import { ModelConfigTab } from './pages/ModelConfigTab'
import { ModelLineageTab } from './pages/ModelLineageTab'
import { RegisterModelPage } from './pages/RegisterModelPage'
import { BenchmarksPage } from './pages/BenchmarksPage'
import { BenchmarkDetailPage } from './pages/BenchmarkDetailPage'
import { BenchmarkOverviewTab } from './pages/BenchmarkOverviewTab'
import { BenchmarkProtocolTab } from './pages/BenchmarkProtocolTab'
import { BenchmarkRunsTab } from './pages/BenchmarkRunsTab'
import { ProfilesPage } from './pages/ProfilesPage'
import { SamplingProfilesTab } from './pages/SamplingProfilesTab'
import { ServingProfilesTab } from './pages/ServingProfilesTab'
import { NewEvaluationPage } from './pages/NewEvaluationPage'
import { RunsPage } from './pages/RunsPage'
import { RunReportPage } from './pages/RunReportPage'
import { RunOverviewTab } from './pages/RunOverviewTab'
import { RunSamplesTab } from './pages/RunSamplesTab'
import { RunConfigTab } from './pages/RunConfigTab'
import { RunLogsTab } from './pages/RunLogsTab'
import { ComparePage } from './pages/ComparePage'
import { InfrastructurePage } from './pages/InfrastructurePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { StyleguidePage } from './pages/StyleguidePage'

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

        {/*
         * PageWide, not Page (Phase 11, docs/UI_REDESIGN_PLAN.md
         * §8.11): the family-grouped cards/table view needs the full
         * width the same way the Leaderboard's own matrix and the Runs
         * page's own table do.
         */}
        <Route
          path="models"
          element={
            <PageWide>
              <ModelsPage />
            </PageWide>
          }
        />
        {/*
         * No nav item -- reached only via the "Register a model"
         * button on the models page. Its four steps live in this
         * page's own component state, not further router segments
         * (R-D30): a deep link to step 3 has nothing to render without
         * step 2's server response.
         */}
        <Route
          path="models/register"
          element={
            <Page>
              <RegisterModelPage />
            </Page>
          }
        />
        {/*
         * The model page (Phase 11, docs/UI_REDESIGN_PLAN.md §8.11):
         * ModelDetailPage owns the header and the tab strip; each child
         * route below is one tab, rendered into its own <Outlet> and
         * reading the already-loaded checkpoint through its outlet
         * context (ModelDetailPage.helper.ts's useModelPage) -- mirrors
         * the run report's own routes above. PageWide, not Page: the
         * Results tab's scorecard grid and the Runs tab's table both
         * need the full width the same way the Leaderboard and Runs
         * pages do.
         */}
        <Route
          path="models/:modelId"
          element={
            <PageWide>
              <ModelDetailPage />
            </PageWide>
          }
        >
          <Route index element={<ModelResultsTab />} />
          <Route path="runs" element={<ModelRunsTab />} />
          <Route path="config" element={<ModelConfigTab />} />
          <Route path="lineage" element={<ModelLineageTab />} />
        </Route>

        {/*
         * The Benchmarks list (Phase 12, docs/UI_REDESIGN_PLAN.md
         * §8.12): replaces StandardsPage. Page, not PageWide -- the
         * category-grouped card grid doesn't need the extra width a
         * data table does.
         */}
        <Route
          path="benchmarks"
          element={
            <Page>
              <BenchmarksPage />
            </Page>
          }
        />
        {/*
         * The Benchmark detail page (Phase 12, docs/UI_REDESIGN_PLAN.md
         * §8.12): BenchmarkDetailPage owns the header and the tab
         * strip; each child route below is one tab, rendered into its
         * own <Outlet> and reading the already-loaded standard through
         * its outlet context (BenchmarkDetailPage.helper.ts's
         * useBenchmarkPage) -- mirrors the model page's own routes
         * above. `:benchmarkId` is the standard id, not the benchmark
         * slug (decision #1): each versioned standard gets its own
         * page. PageWide, not Page: the Overview tab's leaderboard
         * preview and the Runs tab's table both need the full width the
         * same way the model page's own tabs do.
         */}
        <Route
          path="benchmarks/:benchmarkId"
          element={
            <PageWide>
              <BenchmarkDetailPage />
            </PageWide>
          }
        >
          <Route index element={<BenchmarkOverviewTab />} />
          <Route path="protocol" element={<BenchmarkProtocolTab />} />
          <Route path="runs" element={<BenchmarkRunsTab />} />
        </Route>

        {/*
         * Profiles (Phase 12, docs/UI_REDESIGN_PLAN.md §8.12): replaces
         * the separate SamplingProfilesPage/ServingProfilesPage routes
         * with one ProfilesPage owning a PageHeader and a Sampling/
         * Serving TabNav; each child route below is one tab, rendered
         * into ProfilesPage's own <Outlet>. The index route redirects
         * bare /profiles to /profiles/sampling, the same
         * RedirectPreservingSearch every other bare-parent route below
         * uses, so a colleague's saved /profiles link still lands
         * somewhere real.
         */}
        <Route
          path="profiles"
          element={
            <Page>
              <ProfilesPage />
            </Page>
          }
        >
          <Route index element={<RedirectPreservingSearch to={paths.profilesSampling()} />} />
          <Route path="sampling" element={<SamplingProfilesTab />} />
          <Route path="serving" element={<ServingProfilesTab />} />
        </Route>

        {/*
         * New evaluation (Phase 10, docs/UI_REDESIGN_PLAN.md §8.10):
         * NewEvaluationPage replaces SubmitPage's single stacked form
         * with a three-step Choose/Settings/Review flow, whose own
         * step lives in this same route's `?step=` query param rather
         * than a further path segment -- a step has nothing to show
         * without the axis chosen in an earlier one, the same "no
         * server response to deep-link to" reasoning
         * RegisterModelPage's own wizard steps already follow.
         */}
        <Route
          path="evaluate/new"
          element={
            <Page>
              <NewEvaluationPage />
            </Page>
          }
        />

        {/*
         * PageWide, not Page (Phase 9, docs/UI_REDESIGN_PLAN.md §8.9):
         * the batch-grouped table needs the full width the same way the
         * Leaderboard's own matrix and the run report's Samples tab do.
         */}
        <Route
          path="runs"
          element={
            <PageWide>
              <RunsPage />
            </PageWide>
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

        {/*
         * The Infrastructure page (Phase 13, docs/UI_REDESIGN_PLAN.md
         * §8.13): replaces the legacy EndpointsPage -- model server
         * cards, the Start dialog, cluster partitions (read only on a
         * Refresh click, ground rule 15) and system health.
         */}
        <Route
          path="infrastructure"
          element={
            <Page>
              <InfrastructurePage />
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
       * Design-system reference -- dev-only, so it never ships. A
       * sibling of the real app, not a child of it: it is not one of
       * the real pages and has no reason to inherit AppShell.
       */}
      {import.meta.env.DEV && <Route path="/styleguide" element={<StyleguidePage />} />}
    </Routes>
  )
}
