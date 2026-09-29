// Every query key the frontend uses, in one place -- so a key is never
// hand-typed twice with a chance of drifting (docs/UI_REDESIGN_PLAN.md
// Phase 4, Appendix A: "Query hooks and queryKeys" is a contract every
// later phase reads from). Each hook in src/api/queries/ builds its key
// here rather than inline in its own useQuery call.
//
// `allRuns`/`runs` are deliberately two different entries, not one
// parameterised key called with no filters: `allRuns()` is also the
// *prefix* every filtered runs list shares (TanStack Query matches a
// query key by prefix), so invalidating it after a submit or a cancel
// catches every RunsPage/ComparePage list at once, not just the one
// call site happened to fetch with.
import type { RunListFilters, RunPreviewRequest } from '../client'
import type { SampleListFilters } from './runDiagnostics'

export const queryKeys = {
  health: () => ['health'] as const,

  checkpoints: () => ['checkpoints'] as const,
  checkpoint: (checkpointId: number) => ['checkpoint', checkpointId] as const,
  checkpointCandidates: () => ['checkpoint-candidates'] as const,
  checkpointInspection: (reference: string | null) => ['checkpoint-inspection', reference] as const,

  standards: () => ['standards'] as const,
  samplingProfiles: () => ['sampling-profiles'] as const,
  servingProfiles: () => ['serving-profiles'] as const,
  catalogStatus: (resourcePath: string) => ['catalog-status', resourcePath] as const,

  leaderboard: () => ['leaderboard'] as const,

  allRuns: () => ['runs'] as const,
  runs: (filters: RunListFilters) => ['runs', filters] as const,
  run: (runId: number) => ['run', runId] as const,
  // Built from the same request object the preview POST sends, so the
  // key and the body can never drift apart (SubmitPage builds this
  // request once and passes it to both).
  runPreview: (request: RunPreviewRequest) => ['runs-preview', request] as const,

  runDiagnostics: (runId: number) => ['run-diagnostics', runId] as const,
  runSamples: (runId: number, filters: SampleListFilters) => ['run-samples', runId, filters] as const,
  runSample: (runId: number, sampleKey: string | undefined) => ['run-sample', runId, sampleKey] as const,
  runComparison: (leftRunId: number | null, rightRunId: number | null) =>
    ['run-comparison', leftRunId, rightRunId] as const,

  endpoints: () => ['endpoints'] as const,
  clusterPartitions: () => ['cluster-partitions'] as const,
}
