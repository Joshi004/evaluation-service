import type { BenchmarkColumn, ModelRow } from '../../utils/buildLeaderboard'

// The filtered models with no result on any setup of this benchmark --
// the "Not yet evaluated" list. buildRankedRows/RankedRow (the models
// that do have a result) live in buildLeaderboard.ts instead, shared
// with BenchmarkLeaderboardPreview -- this file keeps only the half
// that stays specific to this table.
export function buildNotEvaluatedModels(column: BenchmarkColumn, filteredModels: ModelRow[]): ModelRow[] {
  return filteredModels.filter((model) => column.bestResultsByCheckpointId[model.checkpointId] === undefined)
}
