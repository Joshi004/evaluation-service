import type { Benchmark, Checkpoint, EvalRun, RunProfileSources } from '../data/types'
import { getRecipe } from '../data/recipes'
import { computeMockProfileHash, resolveProfile, type ProfileOverrides } from '../utils/resolveProfile'

export function pairKey(checkpointId: string, benchmarkId: string): string {
  return `${checkpointId}::${benchmarkId}`
}

export function parsePairKey(key: string): { checkpointId: string; benchmarkId: string } {
  const [checkpointId, benchmarkId] = key.split('::')
  return { checkpointId, benchmarkId }
}

export interface SubmissionIntent {
  sources: RunProfileSources
  overrides: ProfileOverrides
  isExploratoryIntent: boolean
  submittedBy: string
}

// is_standard is computed, never a checkbox — a run only counts as
// standard if every Layer 2 setting actually resolved to the benchmark
// default AND the submitter didn't mark it exploratory on purpose. This
// mirrors EVAL_SERVICE_PLAN.md Section 10 exactly: "standard" describes
// what a run used, not what someone hoped it would be treated as.
export function computeIsStandard(sources: RunProfileSources, isExploratoryIntent: boolean): boolean {
  if (isExploratoryIntent) return false
  return sources.sampling === 'benchmark_default' && sources.thinkHandling === 'benchmark_default' && sources.maxTokens === 'benchmark_default'
}

export function estimateGpuHours(benchmark: Benchmark): number {
  return benchmark.typicalGpuHours
}

// `batchId` is computed once per submission (not per pair) by the caller,
// so ids stay unique across a whole batch without any shared mutable
// counter in this module.
export function buildSubmittedRun(checkpoint: Checkpoint, benchmark: Benchmark, intent: SubmissionIntent, batchId: string): EvalRun {
  const recipe = getRecipe(benchmark.id)
  const resolvedProfile = resolveProfile(benchmark, checkpoint, intent.sources, intent.overrides)
  const profileHash = computeMockProfileHash(resolvedProfile, recipe.recipeHash)
  const isStandard = computeIsStandard(intent.sources, intent.isExploratoryIntent)

  return {
    id: `run-submitted-${batchId}-${checkpoint.id}-${benchmark.id}`,
    checkpointId: checkpoint.id,
    benchmarkId: benchmark.id,
    isStandard,
    isSmoke: intent.isExploratoryIntent,
    profileSources: intent.sources,
    resolvedProfile,
    profileHash,
    recipeHash: recipe.recipeHash,
    phase: 'queued',
    submittedBy: intent.submittedBy,
    team: checkpoint.team,
    queuedAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    gpuSeconds: null,
    truncationRate: null,
    errorRate: null,
    outputTokensPerSec: null,
    timeToFirstTokenMs: null,
    slurmJobId: null,
    metrics: [],
    published: false,
    flaggedReason: null,
  }
}
