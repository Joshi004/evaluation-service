import type { EvalRun } from '../data/types'
import { benchmarks } from '../data/benchmarks'

/** Benchmarks that at least one checkpoint in this lineage family has a run on — the lineage benchmark dropdown shouldn't offer options that are always "no data". */
export function getBenchmarksWithFamilyData(familyCheckpointIds: readonly string[], runs: readonly EvalRun[]) {
  const benchmarkIdsWithData = new Set(
    runs.filter((run) => familyCheckpointIds.includes(run.checkpointId)).map((run) => run.benchmarkId),
  )
  return benchmarks.filter((benchmark) => benchmarkIdsWithData.has(benchmark.id))
}
