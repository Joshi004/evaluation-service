import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { AppShell } from './components/AppShell/AppShell'
import { Page, PageWide } from './components/Page/Page'
import { PageSkeleton } from './components/PageSkeleton/PageSkeleton'
import { RedirectPreservingSearch } from './components/RedirectPreservingSearch/RedirectPreservingSearch'
import { paths } from './utils/paths'

// Every real page and tab is its own chunk, loaded only once its
// route is actually visited -- the main bundle was 700+ kB with all
// of these imported eagerly. Each factory's own .then(...) is needed
// because these are named exports, not default ones; React.lazy only
// accepts a module with a `default`.
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage })))
const ModelsPage = lazy(() => import('./pages/ModelsPage').then((m) => ({ default: m.ModelsPage })))
const ModelDetailPage = lazy(() => import('./pages/ModelDetailPage').then((m) => ({ default: m.ModelDetailPage })))
const ModelResultsTab = lazy(() => import('./pages/ModelResultsTab').then((m) => ({ default: m.ModelResultsTab })))
const ModelRunsTab = lazy(() => import('./pages/ModelRunsTab').then((m) => ({ default: m.ModelRunsTab })))
const ModelConfigTab = lazy(() => import('./pages/ModelConfigTab').then((m) => ({ default: m.ModelConfigTab })))
const ModelLineageTab = lazy(() => import('./pages/ModelLineageTab').then((m) => ({ default: m.ModelLineageTab })))
const RegisterModelPage = lazy(() =>
  import('./pages/RegisterModelPage').then((m) => ({ default: m.RegisterModelPage })),
)
const BenchmarksPage = lazy(() => import('./pages/BenchmarksPage').then((m) => ({ default: m.BenchmarksPage })))
const BenchmarkDetailPage = lazy(() =>
  import('./pages/BenchmarkDetailPage').then((m) => ({ default: m.BenchmarkDetailPage })),
)
const BenchmarkOverviewTab = lazy(() =>
  import('./pages/BenchmarkOverviewTab').then((m) => ({ default: m.BenchmarkOverviewTab })),
)
const BenchmarkProtocolTab = lazy(() =>
  import('./pages/BenchmarkProtocolTab').then((m) => ({ default: m.BenchmarkProtocolTab })),
)
const BenchmarkRunsTab = lazy(() =>
  import('./pages/BenchmarkRunsTab').then((m) => ({ default: m.BenchmarkRunsTab })),
)
const ProfilesPage = lazy(() => import('./pages/ProfilesPage').then((m) => ({ default: m.ProfilesPage })))
const SamplingProfilesTab = lazy(() =>
  import('./pages/SamplingProfilesTab').then((m) => ({ default: m.SamplingProfilesTab })),
)
const ServingProfilesTab = lazy(() =>
  import('./pages/ServingProfilesTab').then((m) => ({ default: m.ServingProfilesTab })),
)
const NewEvaluationPage = lazy(() =>
  import('./pages/NewEvaluationPage').then((m) => ({ default: m.NewEvaluationPage })),
)
const RunsPage = lazy(() => import('./pages/RunsPage').then((m) => ({ default: m.RunsPage })))
const RunReportPage = lazy(() => import('./pages/RunReportPage').then((m) => ({ default: m.RunReportPage })))
const RunOverviewTab = lazy(() => import('./pages/RunOverviewTab').then((m) => ({ default: m.RunOverviewTab })))
const RunSamplesTab = lazy(() => import('./pages/RunSamplesTab').then((m) => ({ default: m.RunSamplesTab })))
const RunConfigTab = lazy(() => import('./pages/RunConfigTab').then((m) => ({ default: m.RunConfigTab })))
const RunLogsTab = lazy(() => import('./pages/RunLogsTab').then((m) => ({ default: m.RunLogsTab })))
const ComparePage = lazy(() => import('./pages/ComparePage').then((m) => ({ default: m.ComparePage })))
const InfrastructurePage = lazy(() =>
  import('./pages/InfrastructurePage').then((m) => ({ default: m.InfrastructurePage })),
)
const ChatPage = lazy(() => import('./pages/ChatPage').then((m) => ({ default: m.ChatPage })))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))
// The dev-only styleguide route below never renders in a production
// build, but a bare `lazy(() => import(...))` call still leaves
// Rollup a reachable import() to build a chunk for, even once the
// route JSX using it is eliminated as dead code -- gating the lazy()
// call itself behind the same check that gates the route keeps
// nothing for Rollup to find.
const StyleguidePage = import.meta.env.DEV
  ? lazy(() => import('./pages/StyleguidePage').then((m) => ({ default: m.StyleguidePage })))
  : null

// The real pages, nested under AppShell (sidebar + top bar).
// Leaderboard is the index route ("/"). Every route below mounts an
// existing page component verbatim; no page body changes here, except
// that a route's own wrapper differs when the page itself needs the
// width (the Leaderboard is a wide data table, so that route wraps in
// PageWide instead). Any future page rewrite that needs more width
// only swaps that one route's wrapper, with no change to AppShell.
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
         * PageWide, not Page: the family-grouped cards/table view needs
         * the full width the same way the Leaderboard's own matrix and
         * the Runs page's own table do.
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
         * page's own component state, not further router segments: a
         * deep link to step 3 has nothing to render without step 2's
         * server response.
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
         * The model page: ModelDetailPage owns the header and the tab
         * strip; each child route below is one tab, rendered into its
         * own <Outlet> and reading the already-loaded checkpoint through
         * its outlet context (ModelDetailPage.helper.ts's useModelPage)
         * -- mirrors the run report's own routes above. PageWide, not
         * Page: the Results tab's scorecard grid and the Runs tab's
         * table both need the full width the same way the Leaderboard
         * and Runs pages do.
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
         * The Benchmarks list: Page, not PageWide -- the category-
         * grouped card grid doesn't need the extra width a data table
         * does.
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
         * The Benchmark detail page: BenchmarkDetailPage owns the
         * header and the tab strip; each child route below is one tab,
         * rendered into its own <Outlet> and reading the already-loaded
         * standard through its outlet context
         * (BenchmarkDetailPage.helper.ts's useBenchmarkPage) -- mirrors
         * the model page's own routes above. `:benchmarkId` is the
         * standard id, not the benchmark slug: each versioned standard
         * gets its own page. PageWide, not Page: the Overview tab's
         * leaderboard preview and the Runs tab's table both need the
         * full width the same way the model page's own tabs do.
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
         * Profiles: one ProfilesPage owning a PageHeader and a
         * Sampling/Serving TabNav; each child route below is one tab,
         * rendered into ProfilesPage's own <Outlet>. The index route
         * redirects bare /profiles to /profiles/sampling, the same
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
         * New evaluation: NewEvaluationPage is a three-step
         * Choose/Settings/Review flow, whose own step lives in this
         * same route's `?step=` query param rather than a further path
         * segment -- a step has nothing to show without the axis chosen
         * in an earlier one, the same "no server response to deep-link
         * to" reasoning RegisterModelPage's own wizard steps already
         * follow.
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
         * PageWide, not Page: the batch-grouped table needs the full
         * width the same way the Leaderboard's own matrix and the run
         * report's Samples tab do.
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
         * The run report: RunReportPage owns the header, the verdict
         * band (done runs only) and the tab strip; each child route
         * below is one tab, rendered into RunReportPage's own <Outlet>
         * and reading the already-loaded run through its outlet context
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
         * This tab's old URL, from before it was renamed to
         * .../samples, keeping the same query params (outcome, subset,
         * rule, tag, q, offset -- Appendix A, frozen). A sibling of the
         * report route above, not nested under it -- its only job is
         * to redirect, never to render inside RunReportPage's own
         * frame.
         */}
        <Route
          path="runs/:runId/diagnostics"
          element={<RedirectPreservingSearch to={(params) => paths.runSamples(params.runId ?? '')} />}
        />

        {/*
         * Compare: a sibling of the /runs tree rather than nested under
         * it -- it takes 2-4 run ids via ?runs=, not one. PageWide, not
         * Page: the score matrix's forest plot and the setup-diff table
         * both need the full width, the same reasoning the run report's
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
         * The Infrastructure page: model server cards, the Start
         * dialog, cluster partitions (read only on a Refresh click,
         * ground rule 15) and system health.
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
         * Manual chat against a running model server. One page handles
         * both URLs: /chat lists models (live server, or saved history
         * with none running), /chat/:modelId is one model's
         * conversation. Page, not PageWide -- a message thread reads
         * naturally at the same width as a form, not a wide table.
         */}
        <Route
          path="chat"
          element={
            <Page>
              <ChatPage />
            </Page>
          }
        />
        <Route
          path="chat/:modelId"
          element={
            <Page>
              <ChatPage />
            </Page>
          }
        />

        {/*
         * Old URLs. Redirected rather than broken -- deep links to
         * these are already pasted in Slack. RedirectPreservingSearch
         * keeps any query string; none of these old paths had a
         * sub-path beyond what's listed here.
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
       * the real pages and has no reason to inherit AppShell, so it
       * gets its own Suspense boundary rather than the one AppShell
       * wraps around its own <Outlet /> for every route above.
       */}
      {StyleguidePage && (
        <Route
          path="/styleguide"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <StyleguidePage />
            </Suspense>
          }
        />
      )}
    </Routes>
  )
}
