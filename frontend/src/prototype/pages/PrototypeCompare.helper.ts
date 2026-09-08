import type { Benchmark, EvalRun } from '../data/types'
import { getPrimaryMetricResult } from '../data/runs'
import { confidenceIntervalHalfWidth } from '../utils/confidenceInterval'
import type { MetricUnit } from '../components/ConfidenceInterval/ConfidenceInterval.helper'
import { pickDisplayRun } from './PrototypeLeaderboard.helper'

export const MIN_COMPARE_CHECKPOINTS = 2
export const MAX_COMPARE_CHECKPOINTS = 4

// Always the standard, published run — the same rule the Leaderboard uses
// for a cell. Comparing exploratory runs side by side would be comparing
// different profiles, not different checkpoints, which is exactly the
// kind of unsound comparison this page exists to rule out.
export function getComparisonRun(checkpointId: string, benchmarkId: string, runs: readonly EvalRun[]): EvalRun | null {
  return pickDisplayRun(checkpointId, benchmarkId, runs, true)
}

// A benchmark only earns a row once at least one selected checkpoint has
// something to show for it — an all-dash row is noise, not information.
export function getComparableBenchmarks(
  checkpointIds: readonly string[],
  benchmarks: readonly Benchmark[],
  runs: readonly EvalRun[],
): Benchmark[] {
  return benchmarks.filter((benchmark) =>
    checkpointIds.some((checkpointId) => getComparisonRun(checkpointId, benchmark.id, runs) !== null),
  )
}

export interface TwoWayDelta {
  deltaValue: number
  unit: MetricUnit
  /** True once |B − A| clears the sum of their 95% half-widths — a conservative bar for "outside the noise", not a formal two-sample significance test. */
  isOutsideNoise: boolean
}

export function computeTwoWayDelta(benchmark: Benchmark, runA: EvalRun, runB: EvalRun): TwoWayDelta | null {
  const resultA = getPrimaryMetricResult(runA, benchmark.primaryMetricKey)
  const resultB = getPrimaryMetricResult(runB, benchmark.primaryMetricKey)
  if (!resultA || !resultB) return null

  const primaryMetricDef = benchmark.metrics.find((metric) => metric.key === benchmark.primaryMetricKey)
  const unit: MetricUnit = primaryMetricDef?.unit ?? '%'
  const deltaValue = resultB.value - resultA.value
  const combinedHalfWidth = confidenceIntervalHalfWidth(resultA.stderr) + confidenceIntervalHalfWidth(resultB.stderr)
  return { deltaValue, unit, isOutsideNoise: Math.abs(deltaValue) > combinedHalfWidth }
}

export function formatDeltaMagnitude(delta: TwoWayDelta): string {
  if (delta.deltaValue === 0) return 'no difference'
  const sign = delta.deltaValue > 0 ? '+' : '-'
  const magnitude = Math.abs(delta.deltaValue)
  return delta.unit === '%' ? `${sign}${(magnitude * 100).toFixed(1)} pts` : `${sign}${magnitude.toFixed(3)}`
}

export type DeltaTone = 'positive' | 'negative' | 'neutral'

// Green or red only once the delta clears the noise bar, and only in
// whichever direction this benchmark's own metric actually favors — a
// lower edit-distance is an improvement, everything else is the opposite.
export function deltaTone(delta: TwoWayDelta, higherIsBetter: boolean): DeltaTone {
  if (!delta.isOutsideNoise) return 'neutral'
  const secondCheckpointIsBetter = higherIsBetter ? delta.deltaValue > 0 : delta.deltaValue < 0
  return secondCheckpointIsBetter ? 'positive' : 'negative'
}

// Shared so the Model History page's edge-diff view renders a delta with
// the exact same colors as this page's delta column — the two views
// should never look like they disagree about a difference.
export function deltaToneClass(tone: DeltaTone): string {
  switch (tone) {
    case 'positive':
      return 'text-emerald-400'
    case 'negative':
      return 'text-red-400'
    default:
      return 'text-slate-500'
  }
}
