// Non-DOM logic for CompareStartState.tsx: grouping finished runs by
// benchmark and picking the one the picker opens on.
import type { RunListItem, StandardSummary } from '../../api/client'
import { benchmarkDisplayName } from '../../utils/benchmarkDisplayName'

export interface BenchmarkOption {
  benchmark: string
  displayName: string
  count: number
}

export function buildBenchmarkOptions(runs: RunListItem[], standards: StandardSummary[]): BenchmarkOption[] {
  const countByBenchmark = new Map<string, number>()
  for (const run of runs) {
    countByBenchmark.set(run.benchmark, (countByBenchmark.get(run.benchmark) ?? 0) + 1)
  }
  return [...countByBenchmark.entries()]
    .map(([benchmark, count]) => ({ benchmark, displayName: benchmarkDisplayName(benchmark, standards), count }))
    .sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName))
}

// The benchmark the picker opens on: whatever a preset run id (a lone
// run already in the URL, or the single run a future "Compare
// with..." entry point resolved to) belongs to, else the benchmark
// with the most finished runs -- the same "most models" idea
// buildLeaderboard.ts's own default-setup rule uses, one level up.
export function resolveDefaultBenchmark(
  runs: RunListItem[],
  presetRunIds: number[],
  options: BenchmarkOption[],
): string | null {
  const presetRun = runs.find((run) => presetRunIds.includes(run.id))
  if (presetRun) {
    return presetRun.benchmark
  }
  return options[0]?.benchmark ?? null
}

export function runsForBenchmark(runs: RunListItem[], benchmark: string | null): RunListItem[] {
  return benchmark === null ? [] : runs.filter((run) => run.benchmark === benchmark)
}
