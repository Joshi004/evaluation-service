import type { Benchmark, EvalRun } from '../../data/types'

export interface RadarPoint {
  family: string
  displayScore: number
}

const FAMILY_LABELS: Record<string, string> = {
  'instruction-following': 'Instruction-following',
  math: 'Math',
  knowledge: 'Knowledge',
  'tool-use': 'Tool-use',
  medical: 'Medical',
  'document-understanding': 'Document understanding',
}

// One point per benchmark family this checkpoint has a published standard
// run in, averaged if it covers more than one benchmark in that family.
// Normalized to 0-100 with bigger always better, inverting a
// lower-is-better metric (OmniDocBench's edit distance) rather than
// letting it silently plot backwards on a "bigger wedge is better" chart.
export function buildRadarPoints(checkpointId: string, benchmarks: readonly Benchmark[], runs: readonly EvalRun[]): RadarPoint[] {
  const families = Array.from(new Set(benchmarks.map((benchmark) => benchmark.family)))
  const points: RadarPoint[] = []

  for (const family of families) {
    const scores: number[] = []

    for (const benchmark of benchmarks.filter((b) => b.family === family)) {
      const run = runs.find(
        (candidate) =>
          candidate.checkpointId === checkpointId &&
          candidate.benchmarkId === benchmark.id &&
          candidate.isStandard &&
          candidate.published,
      )
      const result = run?.metrics.find((metric) => metric.metricKey === benchmark.primaryMetricKey)
      if (!result) continue

      const primaryMetricDef = benchmark.metrics.find((metric) => metric.key === benchmark.primaryMetricKey)
      const higherIsBetter = primaryMetricDef?.higherIsBetter ?? true
      scores.push(higherIsBetter ? result.value * 100 : (1 - result.value) * 100)
    }

    if (scores.length === 0) continue
    points.push({ family: FAMILY_LABELS[family] ?? family, displayScore: scores.reduce((sum, s) => sum + s, 0) / scores.length })
  }

  return points
}
