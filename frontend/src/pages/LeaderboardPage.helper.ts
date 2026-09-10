// Non-DOM logic for LeaderboardPage.tsx: turning the API's flat
// (checkpoint, comparison_hash) rows into a checkpoints-as-rows,
// benchmarks-as-columns grid. The backend deliberately returns rows, not
// a pre-pivoted grid (docs/IMPLEMENTATION_PHASES.md) -- this is that
// pivot.

import type { CheckpointListItem, LeaderboardRow } from '../api/client'

interface LeaderboardCell {
  value: number
  comparisonHash: string
}

export interface LeaderboardGridRow {
  checkpointId: number
  checkpointName: string
  cellsByBenchmark: Record<string, LeaderboardCell>
}

export interface LeaderboardGrid {
  benchmarks: string[]
  rows: LeaderboardGridRow[]
}

export function buildLeaderboardGrid(
  rows: LeaderboardRow[],
  checkpoints: CheckpointListItem[],
): LeaderboardGrid {
  const checkpointNameById = new Map(checkpoints.map((checkpoint) => [checkpoint.id, checkpoint.name]))
  const benchmarks = [...new Set(rows.map((row) => row.benchmark))].sort()

  const rowsByCheckpoint = new Map<number, LeaderboardGridRow>()
  for (const row of rows) {
    let gridRow = rowsByCheckpoint.get(row.checkpoint_id)
    if (!gridRow) {
      gridRow = {
        checkpointId: row.checkpoint_id,
        checkpointName: checkpointNameById.get(row.checkpoint_id) ?? `#${row.checkpoint_id}`,
        cellsByBenchmark: {},
      }
      rowsByCheckpoint.set(row.checkpoint_id, gridRow)
    }
    // If a checkpoint was ever run under two different comparison
    // hashes for the same benchmark (e.g. the same standard under two
    // different sampling profiles), the later-finished one wins the
    // cell -- the query already picked each comparison hash's most
    // recent finished run, so this only matters across comparison
    // hashes, which is rare enough not to need a richer cell shape yet.
    gridRow.cellsByBenchmark[row.benchmark] = {
      value: row.metric_value,
      comparisonHash: row.comparison_hash,
    }
  }

  return {
    benchmarks,
    rows: [...rowsByCheckpoint.values()].sort((a, b) => a.checkpointName.localeCompare(b.checkpointName)),
  }
}
