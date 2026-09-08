import type { Benchmark, Checkpoint, EvalRun } from '../../data/types'

export interface ScatterPoint {
  checkpointId: string
  checkpointName: string
  score: number
  outputTokensPerSec: number
  gpuHours: number
}

// Only standard, published runs with measured throughput go on this chart
// — it's making a credibility claim ("this is what we actually measured
// on our own hardware"), so it shouldn't mix in exploratory numbers.
export function buildScatterPoints(
  benchmark: Benchmark,
  checkpoints: readonly Checkpoint[],
  runs: readonly EvalRun[],
): ScatterPoint[] {
  const points: ScatterPoint[] = []

  for (const checkpoint of checkpoints) {
    const run = runs.find(
      (candidate) =>
        candidate.checkpointId === checkpoint.id &&
        candidate.benchmarkId === benchmark.id &&
        candidate.isStandard &&
        candidate.published &&
        candidate.outputTokensPerSec !== null &&
        candidate.gpuSeconds !== null,
    )
    if (!run || run.outputTokensPerSec === null || run.gpuSeconds === null) continue

    const result = run.metrics.find((metric) => metric.metricKey === benchmark.primaryMetricKey)
    if (!result) continue

    points.push({
      checkpointId: checkpoint.id,
      checkpointName: checkpoint.name,
      score: result.value,
      outputTokensPerSec: run.outputTokensPerSec,
      gpuHours: run.gpuSeconds / 3600,
    })
  }

  return points
}
