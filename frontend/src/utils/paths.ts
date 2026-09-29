// Typed route builders -- the one place every page and component gets a
// path string from, instead of each hand-writing its own template
// literal (docs/UI_REDESIGN_PLAN.md Phase 2, Appendix A: this contract
// is owned here and used by every later phase). Some targets below
// don't have a mounted route yet -- model/benchmark point at Phase
// 11/12 detail pages -- but the builder exists now so later phases
// extend this file instead of inventing a second path module.
export const paths = {
  leaderboard: () => '/',
  models: () => '/models',
  modelRegister: () => '/models/register',
  model: (modelId: number | string) => `/models/${modelId}`,
  benchmarks: () => '/benchmarks',
  benchmark: (benchmarkId: number | string) => `/benchmarks/${benchmarkId}`,
  profilesSampling: () => '/profiles/sampling',
  profilesServing: () => '/profiles/serving',
  // `params` prefills the Choose step (Phase 10's own `?models=&
  // benchmarks=&from=` contract, Appendix A) -- the Leaderboard's
  // empty-cell and "Evaluate on missing benchmarks" links pass
  // `models`/`benchmarks`; the run report's Re-run action (Phase 7)
  // passes `from` alone. Every other call site keeps calling this with
  // no arguments, which still returns the bare path.
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
  // `filters` narrows Phase 9's own `?model=&benchmark=&batch=` contract
  // (Appendix A) -- the Leaderboard's "N other setup" and "view this
  // model's run history" links pass `model`/`benchmark`; the run
  // report's batch link (Phase 7) passes `batch` alone. RunsPage itself
  // doesn't read `batch` yet -- Phase 9 rewrites it to.
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
  // Phase 7 (docs/UI_REDESIGN_PLAN.md §8.7) renames the old
  // .../diagnostics route to .../samples, keeping the same query
  // params (outcome, subset, rule, tag, q, offset -- Appendix A,
  // frozen). There is no `runDiagnostics` builder any more: the one
  // remaining reference to that path is routes.tsx's own redirect
  // source, which nothing should be minting new links to.
  runSamples: (runId: number | string) => `/runs/${runId}/samples`,
  runSample: (runId: number | string, sampleKey: string) =>
    `/runs/${runId}/samples/${encodeURIComponent(sampleKey)}`,
  runConfig: (runId: number | string) => `/runs/${runId}/config`,
  runLogs: (runId: number | string) => `/runs/${runId}/logs`,
  // The canonical compare URL (Phase 8, docs/UI_REDESIGN_PLAN.md §8.8):
  // 2-4 run ids, first = baseline. The tray's own Compare button, the
  // Leaderboard's and Model page's "Compare with..." entry points, and
  // Make baseline/Add run/Remove on the compare page itself all build
  // their target through this one function. No arguments (the
  // sidebar's Compare link) is just '/compare' -- the page's own start
  // state then reads whatever the tray already holds.
  compare: (runIds?: number[]) => (runIds && runIds.length > 0 ? `/compare?runs=${runIds.join(',')}` : '/compare'),
  infrastructure: () => '/infrastructure',
}
