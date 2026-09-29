import type { ModelRow, ScoreCellData, SetupOption } from '../../utils/buildLeaderboard'

export interface RankedRow {
  model: ModelRow
  cell: ScoreCellData
}

// Every model that both passes the page's own search/family filter and
// has a result on this setup, best rank first -- `cell.rank` already
// comes from the shared rankScores helper (buildLeaderboard.ts), so
// this is just "join it back to the filtered model list and order by
// it", not a second ranking computation.
export function buildRankedRows(setup: SetupOption, filteredModels: ModelRow[]): RankedRow[] {
  const rows: RankedRow[] = []
  for (const model of filteredModels) {
    const cell = setup.cellsByCheckpointId[model.checkpointId]
    if (cell) {
      rows.push({ model, cell })
    }
  }
  return rows.sort((a, b) => a.cell.rank - b.cell.rank)
}

// The filtered models with no result on this setup -- the "Not yet
// evaluated on this setup" list.
export function buildNotEvaluatedModels(setup: SetupOption, filteredModels: ModelRow[]): ModelRow[] {
  return filteredModels.filter((model) => setup.cellsByCheckpointId[model.checkpointId] === undefined)
}
