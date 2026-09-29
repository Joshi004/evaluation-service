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

// A shared axis for every whisker on the board, padded a little past
// the widest interval so the end caps are never drawn flush against
// the SVG's own edge -- what makes this genuinely a forest plot (every
// row directly comparable) rather than each row independently zoomed
// to its own interval.
export function computeIntervalDomain(cells: ScoreCellData[]): { min: number; max: number } {
  if (cells.length === 0) {
    return { min: 0, max: 1 }
  }
  const lowerBounds = cells.map((cell) => cell.confidenceInterval?.lower ?? cell.value)
  const upperBounds = cells.map((cell) => cell.confidenceInterval?.upper ?? cell.value)
  const rawMin = Math.min(...lowerBounds)
  const rawMax = Math.max(...upperBounds)
  const span = rawMax - rawMin
  const padding = span === 0 ? 0.05 : span * 0.15
  return { min: Math.max(0, rawMin - padding), max: Math.min(1, rawMax + padding) }
}
