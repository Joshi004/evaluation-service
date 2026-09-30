import type { ModelRow, SetupOption } from '../../utils/buildLeaderboard'

// The filtered models with no result on this setup -- the "Not yet
// evaluated on this setup" list. buildRankedRows/RankedRow used to
// live alongside this but moved into buildLeaderboard.ts (Phase 12,
// docs/UI_REDESIGN_PLAN.md §8.12) once the Benchmark detail page's own
// leaderboard preview became a second caller for the ranked half only
// -- this file keeps the half that stays specific to this table.
export function buildNotEvaluatedModels(setup: SetupOption, filteredModels: ModelRow[]): ModelRow[] {
  return filteredModels.filter((model) => setup.cellsByCheckpointId[model.checkpointId] === undefined)
}
