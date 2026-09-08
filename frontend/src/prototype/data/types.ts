// Shared types for the vision prototype's mocked domain model. These mirror
// the shapes in docs/EVAL_SERVICE_PLAN.md Section 10 and docs/DATA_MODEL.md,
// simplified down to what the 5 demo screens need to render — this is a
// throwaway UI mock, not a client for a real schema.

export type Team = 'tool-call' | 'one-bit-models' | 'vlm-eval' | 'medpsy'

export type Modality = 'text' | 'vision' | 'medical' | 'tool-use'

export type BenchmarkFamily =
  | 'instruction-following'
  | 'math'
  | 'knowledge'
  | 'tool-use'
  | 'medical'
  | 'document-understanding'

export interface BenchmarkMetricDefinition {
  key: string
  displayName: string
  unit: '%' | 'edit-distance'
  higherIsBetter: boolean
  isPrimary: boolean
  /** The harness's own name for this metric, e.g. lm-eval's `exact_match,strict-match`. */
  harnessKey: string
}

export interface Benchmark {
  id: string
  name: string
  family: BenchmarkFamily
  modality: Modality
  frameworkId: string
  whereItRuns: 'service' | 'cluster'
  questionCount: number
  metrics: BenchmarkMetricDefinition[]
  primaryMetricKey: string
  /** Typical GPU-hours for one standard run, used for the Submit page's dry-run estimate. */
  typicalGpuHours: number
  /** A plausible [min, max] range for this benchmark's primary metric, in the metric's own unit. Used only to fabricate a believable score for a (checkpoint, benchmark) pair that has no hand-authored run. */
  plausibleScoreRange: [number, number]
}

export type ProfileSource = 'benchmark_default' | 'user_provided' | 'from_checkpoint'

export type ThinkHandling = 'strip' | 'raw' | 'disallowed'

export interface ResolvedProfile {
  temperature: number
  topP: number
  topK: number
  maxTokens: number
  thinkHandling: ThinkHandling
}

export interface RunProfileSources {
  sampling: ProfileSource
  thinkHandling: ProfileSource
  maxTokens: ProfileSource
}

export interface Recipe {
  benchmarkId: string
  version: string
  status: 'active' | 'deprecated'
  datasetRevision: string
  fewShot: number
  promptTemplate: string
  extraction: string
  repeats: number
  defaultSampling: { temperature: number; topP: number; topK: number }
  defaultMaxTokens: number
  defaultThinkHandling: ThinkHandling
  sourceNote: string
  changelog: string[]
  recipeHash: string
}

export interface Checkpoint {
  id: string
  name: string
  team: Team
  modality: Modality
  sizeParams: string
  quantization: string | null
  parentId: string | null
  lineageOp: string | null
  lineageDetail: string | null
  storage: 'nfs' | 's3'
  staged: boolean
  published: boolean
  registeredBy: string
  createdAt: string
  trainingRunUrl: string | null
  notes: string
  /**
   * Set only for a checkpoint created by the Model History page's merge
   * flow — the two source checkpoint ids, in the order they were selected.
   * `parentId` stays null for these: the schema has a single
   * `parent_checkpoint_id` column (see docs/DATA_MODEL.md), so a merge's
   * second parent has nowhere to go there either. The lineage graph's
   * edges are the real source of truth for a merge's two parents; this
   * field exists so the checkpoint inspector panel can show them without
   * searching every edge.
   */
  mergedFromIds: string[] | null
}

/** The merge algorithms offered on the Model History page's merge dialog — a fixed, illustrative list, not a real implementation of any of them. */
export type MergeMethod = 'linear' | 'slerp' | 'ties' | 'dare'

export type RunPhase =
  | 'queued'
  | 'staging'
  | 'waiting_endpoint'
  | 'inference'
  | 'scoring'
  | 'completed'
  | 'failed'

export interface RunMetricResult {
  metricKey: string
  value: number
  stderr: number
}

export interface EvalRun {
  id: string
  checkpointId: string
  benchmarkId: string
  isStandard: boolean
  isSmoke: boolean
  profileSources: RunProfileSources
  resolvedProfile: ResolvedProfile
  profileHash: string
  recipeHash: string
  phase: RunPhase
  submittedBy: string
  team: Team
  queuedAt: string
  startedAt: string | null
  finishedAt: string | null
  gpuSeconds: number | null
  truncationRate: number | null
  errorRate: number | null
  outputTokensPerSec: number | null
  timeToFirstTokenMs: number | null
  slurmJobId: string | null
  metrics: RunMetricResult[]
  published: boolean
  /** Set when a diagnostic (truncation rate, error rate) crossed its threshold — see EVAL_SERVICE_PLAN.md Section 5, "Two diagnostics every run should report". */
  flaggedReason: string | null
}

export interface LineageNodePosition {
  checkpointId: string
  x: number
  y: number
}

export interface LineageEdge {
  fromCheckpointId: string
  toCheckpointId: string
  operation: string
  detail: string
  trainingRunUrl: string | null
}

export interface PredictionExample {
  id: string
  /** Shared across every checkpoint's response to the same question, so Compare can line them up. */
  questionId: string
  benchmarkId: string
  prompt: string
  checkpointId: string
  response: string
  correct: boolean
}
