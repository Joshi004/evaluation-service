// Typed route builders -- the one place every page and component gets a
// path string from, instead of each hand-writing its own template
// literal.
export const paths = {
  // Bare '/' for every existing call site (the sidebar link, the
  // not-found page's "Back to Leaderboard"); a `target` opens straight
  // into the By-benchmark lens on one benchmark (the Benchmark detail
  // page's own "View full ranking" link). The two params written here
  // (`lens`, `sort`) must match LeaderboardPage.helper.ts's own URL
  // contract exactly -- duplicated as literals rather than imported,
  // since this module is a leaf every layer (including pages) imports,
  // and a page helper must never import back from utils/paths.ts's own
  // directory.
  leaderboard: (target?: { benchmark: string }) => {
    if (!target) {
      return '/'
    }
    const search = new URLSearchParams()
    search.set('lens', 'benchmark')
    search.set('sort', target.benchmark)
    return `/?${search.toString()}`
  },
  // `filters` jumps straight into one family (the model page header's
  // own family chip) -- every other call site keeps calling
  // this with no arguments, same as `newEvaluation`/`runs` above.
  models: (filters?: { family?: string }) => {
    const family = filters?.family
    if (family === undefined) {
      return '/models'
    }
    const search = new URLSearchParams()
    search.set('family', family)
    return `/models?${search.toString()}`
  },
  modelRegister: () => '/models/register',
  model: (modelId: number | string) => `/models/${modelId}`,
  // The model page's three non-index tabs. There is no `modelResults`
  // builder -- the Results tab is the bare `model()` path, the same
  // "index tab has no suffix" convention `run()` already uses for the
  // run report's Overview tab.
  modelRuns: (modelId: number | string) => `/models/${modelId}/runs`,
  modelConfig: (modelId: number | string) => `/models/${modelId}/config`,
  modelLineage: (modelId: number | string) => `/models/${modelId}/lineage`,
  benchmarks: () => '/benchmarks',
  // The benchmark detail page's own path tabs, mirroring
  // modelRuns/modelConfig's own "index tab has no suffix" convention
  // above.
  benchmark: (benchmarkId: number | string) => `/benchmarks/${benchmarkId}`,
  benchmarkProtocol: (benchmarkId: number | string) => `/benchmarks/${benchmarkId}/protocol`,
  benchmarkRuns: (benchmarkId: number | string) => `/benchmarks/${benchmarkId}/runs`,
  // The merged Profiles page: a bare call is the page's own
  // default redirect target; profilesSampling/profilesServing below
  // are its two path tabs, kept as their own named builders since
  // every existing call site already names one or the other directly.
  profiles: () => '/profiles',
  profilesSampling: () => '/profiles/sampling',
  profilesServing: () => '/profiles/serving',
  // `params` prefills the Choose step's `?models=&benchmarks=&from=`
  // contract -- the Leaderboard's empty-cell and "Evaluate on missing
  // benchmarks" links pass `models`/`benchmarks`; the run report's
  // Re-run action passes `from` alone. Every other call site keeps
  // calling this with no arguments, which still returns the bare path.
  newEvaluation: (params?: { models?: number[]; benchmarks?: number[]; from?: number }) => {
    const models = params?.models ?? []
    const benchmarks = params?.benchmarks ?? []
    const from = params?.from
    if (models.length === 0 && benchmarks.length === 0 && from === undefined) {
      return '/evaluate/new'
    }
    const search = new URLSearchParams()
    if (models.length > 0) search.set('models', models.join(','))
    if (benchmarks.length > 0) search.set('benchmarks', benchmarks.join(','))
    if (from !== undefined) search.set('from', String(from))
    return `/evaluate/new?${search.toString()}`
  },
  // `filters` narrows the `?model=&benchmark=&batch=` contract -- the
  // Leaderboard's "N other setup" and "view this model's run history"
  // links pass `model`/`benchmark`; the run report's batch link
  // passes `batch` alone.
  runs: (filters?: { model?: number; benchmark?: string; batch?: number }) => {
    const model = filters?.model
    const benchmark = filters?.benchmark
    const batch = filters?.batch
    if (model === undefined && benchmark === undefined && batch === undefined) {
      return '/runs'
    }
    const search = new URLSearchParams()
    if (model !== undefined) search.set('model', String(model))
    if (benchmark !== undefined) search.set('benchmark', benchmark)
    if (batch !== undefined) search.set('batch', String(batch))
    return `/runs?${search.toString()}`
  },
  run: (runId: number | string) => `/runs/${runId}`,
  // Query params (outcome, subset, rule, tag, q, offset) are frozen.
  // There is no `runDiagnostics` builder any more: the one remaining
  // reference to the old .../diagnostics path is routes.tsx's own
  // redirect source, which nothing should be minting new links to.
  runSamples: (runId: number | string) => `/runs/${runId}/samples`,
  runSample: (runId: number | string, sampleKey: string) =>
    `/runs/${runId}/samples/${encodeURIComponent(sampleKey)}`,
  runConfig: (runId: number | string) => `/runs/${runId}/config`,
  runLogs: (runId: number | string) => `/runs/${runId}/logs`,
  // The canonical compare URL: 2-4 run ids, first = baseline. The
  // tray's own Compare button, the Leaderboard's and Model page's
  // "Compare with..." entry points, and Make baseline/Add run/Remove
  // on the compare page itself all build their target through this
  // one function. No arguments (the sidebar's Compare link) is just
  // '/compare' -- the page's own start state then reads whatever the
  // tray already holds.
  compare: (runIds?: number[]) => (runIds && runIds.length > 0 ? `/compare?runs=${runIds.join(',')}` : '/compare'),
  infrastructure: () => '/infrastructure',
  // Bare call is the model list (also the sidebar's own link);
  // `modelId` goes straight to that model's own conversation --
  // ModelServerCard's own Chat button and the chat list page's own
  // rows both pass it.
  chat: (modelId?: number | string) => (modelId === undefined ? '/chat' : `/chat/${modelId}`),
}
