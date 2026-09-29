// Typed route builders -- the one place every page and component gets a
// path string from, instead of each hand-writing its own template
// literal (docs/UI_REDESIGN_PLAN.md Phase 2, Appendix A: this contract
// is owned here and used by every later phase). Some targets below
// don't have a mounted route yet -- model/benchmark point at Phase
// 11/12 detail pages, and compare's ?runs= shape is only read by
// ComparePage once Phase 8 migrates it off left/right -- but the
// builder exists now so later phases extend this file instead of
// inventing a second path module.
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
  // benchmarks=` contract, Appendix A) -- the Leaderboard's empty-cell
  // and "Evaluate on missing benchmarks" links are today's only
  // callers that pass one; every other call site keeps calling this
  // with no arguments, which still returns the bare path.
  newEvaluation: (params?: { models?: number[]; benchmarks?: number[] }) => {
    const models = params?.models ?? []
    const benchmarks = params?.benchmarks ?? []
    if (models.length === 0 && benchmarks.length === 0) {
      return '/evaluate/new'
    }
    const search = new URLSearchParams()
    if (models.length > 0) search.set('models', models.join(','))
    if (benchmarks.length > 0) search.set('benchmarks', benchmarks.join(','))
    return `/evaluate/new?${search.toString()}`
  },
  // `filters` narrows Phase 9's own `?model=&benchmark=` contract
  // (Appendix A) -- the Leaderboard's "N other setup" and "view this
  // model's run history" links are today's only callers.
  runs: (filters?: { model?: number; benchmark?: string }) => {
    const model = filters?.model
    const benchmark = filters?.benchmark
    if (model === undefined && benchmark === undefined) {
      return '/runs'
    }
    const search = new URLSearchParams()
    if (model !== undefined) search.set('model', String(model))
    if (benchmark !== undefined) search.set('benchmark', benchmark)
    return `/runs?${search.toString()}`
  },
  run: (runId: number | string) => `/runs/${runId}`,
  runDiagnostics: (runId: number | string) => `/runs/${runId}/diagnostics`,
  runSample: (runId: number | string, sampleKey: string) =>
    `/runs/${runId}/samples/${encodeURIComponent(sampleKey)}`,
  // The ?runs= shape is decision territory of Phase 8 (Appendix A), but
  // the builder is defined here so nothing later reinvents it. No
  // Phase 2 caller passes runIds -- the sidebar's Compare link calls
  // this with no arguments, which is just '/compare'.
  compare: (runIds?: number[]) => (runIds && runIds.length > 0 ? `/compare?runs=${runIds.join(',')}` : '/compare'),
  // Temporary (Phase 5): ComparePage only reads today's ?left=&right=
  // shape until Phase 8 migrates it to ?runs= above and raises
  // MAX_COMPARE_RUNS to 4. CompareTray's own Compare button calls this,
  // not paths.compare(), until then.
  compareLeftRight: (leftRunId: number, rightRunId: number) => `/compare?left=${leftRunId}&right=${rightRunId}`,
  infrastructure: () => '/infrastructure',
}
