import type { ModelRow, SetupOption } from '../../utils/buildLeaderboard'

// The filtered models with no result on this setup -- the "Not yet
// evaluated on this setup" list. buildRankedRows/RankedRow (the models
// that do have a result) live in buildLeaderboard.ts instead, shared
// with BenchmarkLeaderboardPreview -- this file keeps only the half
// that stays specific to this table.
export function buildNotEvaluatedModels(setup: SetupOption, filteredModels: ModelRow[]): ModelRow[] {
  return filteredModels.filter((model) => setup.cellsByCheckpointId[model.checkpointId] === undefined)
}
