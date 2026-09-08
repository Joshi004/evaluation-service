import type { Benchmark, Checkpoint, EvalRun, LineageEdge, MergeMethod } from '../../data/types'
import { getPrimaryMetricResult } from '../../data/runs'
import type { MetricUnit } from '../ConfidenceInterval/ConfidenceInterval.helper'

export const MERGE_METHOD_OPTIONS: { value: MergeMethod; label: string; description: string }[] = [
  { value: 'linear', label: 'Linear', description: "A simple weighted average of the two checkpoints' weights." },
  {
    value: 'slerp',
    label: 'SLERP',
    description: 'Spherical interpolation between the two — often keeps each model\u2019s individual behavior more intact than a linear blend.',
  },
  {
    value: 'ties',
    label: 'TIES',
    description: 'Trims small, conflicting parameter changes before merging, to reduce interference between the two.',
  },
  {
    value: 'dare',
    label: 'DARE',
    description: 'Randomly drops and rescales parameter deltas before merging, to reduce interference between the two.',
  },
]

function methodLabel(method: MergeMethod): string {
  return MERGE_METHOD_OPTIONS.find((option) => option.value === method)?.label ?? method
}

export function defaultMergedCheckpointName(checkpointA: Checkpoint, checkpointB: Checkpoint): string {
  return `${checkpointA.name} + ${checkpointB.name} (merge)`
}

export interface MergeCompatibility {
  isCompatible: boolean
  reason: string | null
}

// Guardrails using only fields the fixtures already carry — no new
// "compatibility" concept invented for this page. Each reason is written
// out in full so a rejected merge explains itself in the dialog rather
// than the button just going quietly disabled.
export function checkMergeCompatibility(a: Checkpoint, b: Checkpoint): MergeCompatibility {
  if (a.modality !== b.modality) {
    return {
      isCompatible: false,
      reason: `${a.name} is ${a.modality} and ${b.name} is ${b.modality} — merging checkpoints of different modalities isn't supported.`,
    }
  }
  if (a.sizeParams !== b.sizeParams) {
    return {
      isCompatible: false,
      reason: `${a.name} is ${a.sizeParams} and ${b.name} is ${b.sizeParams} — merging different parameter counts isn't supported.`,
    }
  }
  if (a.quantization !== b.quantization) {
    return {
      isCompatible: false,
      reason: `${a.name} is ${a.quantization ?? 'unquantized'} and ${b.name} is ${b.quantization ?? 'unquantized'} — merging checkpoints with different quantization isn't supported.`,
    }
  }
  return { isCompatible: true, reason: null }
}

// Standard, published run only — the same "authoritative cell" rule the
// Leaderboard and Compare pages use. Kept as a local one-liner rather than
// importing pickDisplayRun from another page's helper, so this component
// has no dependency on a page module.
function findStandardPublishedRun(checkpointId: string, benchmarkId: string, runs: readonly EvalRun[]): EvalRun | null {
  return (
    runs.find(
      (run) => run.checkpointId === checkpointId && run.benchmarkId === benchmarkId && run.phase === 'completed' && run.isStandard && run.published,
    ) ?? null
  )
}

export interface EstimatedBenchmarkScore {
  benchmark: Benchmark
  estimatedValue: number
  unit: MetricUnit
  /** False when only one side has a real result — the estimate then just carries that one value forward, regardless of weight. */
  hasRealDataForBoth: boolean
}

/**
 * A weight-interpolated *estimate* of the merged checkpoint's score, for
 * every benchmark where at least one parent has a standard, published
 * result. Real merge quality is not linear in score — this exists to make
 * the dialog feel concrete before anything is measured, not as a claim
 * about the actual merged model, which is why every caller of this labels
 * it "estimated".
 */
export function estimateMergedScores(
  checkpointA: Checkpoint,
  checkpointB: Checkpoint,
  weightPercentA: number,
  benchmarks: readonly Benchmark[],
  runs: readonly EvalRun[],
): EstimatedBenchmarkScore[] {
  const weightA = weightPercentA / 100
  const rows: EstimatedBenchmarkScore[] = []

  for (const benchmark of benchmarks) {
    const runA = findStandardPublishedRun(checkpointA.id, benchmark.id, runs)
    const runB = findStandardPublishedRun(checkpointB.id, benchmark.id, runs)
    const resultA = runA ? getPrimaryMetricResult(runA, benchmark.primaryMetricKey) : null
    const resultB = runB ? getPrimaryMetricResult(runB, benchmark.primaryMetricKey) : null

    const knownValue = resultA?.value ?? resultB?.value
    if (knownValue === undefined) continue

    const valueA = resultA?.value ?? knownValue
    const valueB = resultB?.value ?? knownValue
    const primaryMetricDef = benchmark.metrics.find((metric) => metric.key === benchmark.primaryMetricKey)

    rows.push({
      benchmark,
      estimatedValue: valueA * weightA + valueB * (1 - weightA),
      unit: primaryMetricDef?.unit ?? '%',
      hasRealDataForBoth: Boolean(resultA && resultB),
    })
  }

  return rows
}

/** Builds the new checkpoint and its two incoming "Merge" edges — the caller dispatches both to the store via mergeCheckpoints. */
export function buildMergedCheckpoint(
  checkpointA: Checkpoint,
  checkpointB: Checkpoint,
  method: MergeMethod,
  weightPercentA: number,
  name: string,
): { checkpoint: Checkpoint; edges: LineageEdge[] } {
  const id = `merge-${Date.now()}`
  const detail = `${methodLabel(method)} merge, ${weightPercentA}% ${checkpointA.name} / ${100 - weightPercentA}% ${checkpointB.name}`

  const checkpoint: Checkpoint = {
    id,
    name,
    team: checkpointA.team,
    modality: checkpointA.modality,
    sizeParams: checkpointA.sizeParams,
    quantization: checkpointA.quantization,
    parentId: null,
    lineageOp: 'Merge',
    lineageDetail: detail,
    storage: 'nfs',
    staged: false,
    published: false,
    registeredBy: 'demo-user',
    createdAt: new Date().toISOString().slice(0, 10),
    trainingRunUrl: null,
    notes: `Created on the Model History page by merging ${checkpointA.name} and ${checkpointB.name}.`,
    mergedFromIds: [checkpointA.id, checkpointB.id],
  }

  const edges: LineageEdge[] = [
    { fromCheckpointId: checkpointA.id, toCheckpointId: id, operation: 'Merge', detail, trainingRunUrl: null },
    { fromCheckpointId: checkpointB.id, toCheckpointId: id, operation: 'Merge', detail, trainingRunUrl: null },
  ]

  return { checkpoint, edges }
}
