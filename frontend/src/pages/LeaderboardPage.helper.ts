// Non-DOM logic for LeaderboardPage.tsx: turning the API's flat
// (checkpoint, comparison_hash) rows into a checkpoints-as-rows,
// comparison-hashes-as-columns grid. The backend deliberately returns
// rows, not a pre-pivoted grid (docs/IMPLEMENTATION_PHASES.md) -- this
// is that pivot.
//
// Columns key on comparison_hash, not benchmark (Phase 8,
// docs/STANDARDS_AND_PROFILES_PHASES.md): two rows for the same
// benchmark but a different resolved sampling profile are two columns,
// never one merged cell (S-D36) -- a checkpoint run under
// ifeval/v1 + greedy and one run under ifeval/v1 + qwen3_think measured
// two different things and must not share a column just because they
// share a benchmark name.

import type { CheckpointListItem, LeaderboardRow } from '../api/client'
import { samplingProfileDisplayName } from '../utils/samplingProfileDisplayName'
import { standardDisplayName } from '../utils/standardDisplayName'

export interface LeaderboardColumn {
  comparisonHash: string
  benchmark: string
  standardLabel: string
  samplingProfileLabel: string
}

// One leaderboard cell's value plus which run produced it -- the run id
// is what MetricCell links to (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md
// Phase 1).
export interface LeaderboardCell {
  value: number
  evalRunId: number
}

export interface LeaderboardGridRow {
  checkpointId: number
  checkpointName: string
  cellsByComparisonHash: Record<string, LeaderboardCell>
}

export interface LeaderboardGrid {
  columns: LeaderboardColumn[]
  rows: LeaderboardGridRow[]
}

// One column per comparison_hash actually present in the rows -- built
// from the first row seen for that hash, since every row sharing a
// comparison_hash shares the same standard and resolved sampling
// profile by definition (S-D5).
function buildColumns(rows: LeaderboardRow[]): LeaderboardColumn[] {
  const columnsByHash = new Map<string, LeaderboardColumn>()
  for (const row of rows) {
    if (!columnsByHash.has(row.comparison_hash)) {
      columnsByHash.set(row.comparison_hash, {
        comparisonHash: row.comparison_hash,
        benchmark: row.benchmark,
        standardLabel: standardDisplayName(row.label, row.standard_hash),
        samplingProfileLabel: samplingProfileDisplayName(
          row.sampling_profile_label,
          row.sampling_profile_hash,
        ),
      })
    }
  }

  // Sorted benchmark-then-sampling-profile-then-hash, so two variants
  // of the same benchmark (S-T32 -- e.g. IFEval under greedy and under
  // qwen3_think) sit next to each other instead of being scattered by
  // hash order, which is otherwise meaningless to a reader.
  return [...columnsByHash.values()].sort(
    (a, b) =>
      a.benchmark.localeCompare(b.benchmark) ||
      a.samplingProfileLabel.localeCompare(b.samplingProfileLabel) ||
      a.comparisonHash.localeCompare(b.comparisonHash),
  )
}

export function buildLeaderboardGrid(
  rows: LeaderboardRow[],
  checkpoints: CheckpointListItem[],
): LeaderboardGrid {
  const checkpointNameById = new Map(checkpoints.map((checkpoint) => [checkpoint.id, checkpoint.name]))
  const columns = buildColumns(rows)

  const rowsByCheckpoint = new Map<number, LeaderboardGridRow>()
  for (const row of rows) {
    let gridRow = rowsByCheckpoint.get(row.checkpoint_id)
    if (!gridRow) {
      gridRow = {
        checkpointId: row.checkpoint_id,
        checkpointName: checkpointNameById.get(row.checkpoint_id) ?? `#${row.checkpoint_id}`,
        cellsByComparisonHash: {},
      }
      rowsByCheckpoint.set(row.checkpoint_id, gridRow)
    }
    // The backend's own DISTINCT ON (checkpoint_id, comparison_hash)
    // already guarantees at most one row per (checkpoint, comparison
    // hash) pair, so unlike the old benchmark-keyed pivot, there is no
    // same-cell collision left to resolve here.
    gridRow.cellsByComparisonHash[row.comparison_hash] = {
      value: row.metric_value,
      evalRunId: row.eval_run_id,
    }
  }

  return {
    columns,
    rows: [...rowsByCheckpoint.values()].sort((a, b) => a.checkpointName.localeCompare(b.checkpointName)),
  }
}

// Phase 9 (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md): picking exactly
// two leaderboard cells to send to the compare page.
export const MAX_COMPARE_SELECTION = 2

// Adds or removes a run id from the current selection. A third pick is
// a no-op, never an eviction of an existing one -- "a third checkbox
// is disabled rather than silently evicting a selection, so the
// 'exactly two' rule is visible" (Phase 9's own wording) means this
// function is only ever asked to add when there's room, or remove.
export function toggleRunSelection(current: number[], evalRunId: number): number[] {
  if (current.includes(evalRunId)) {
    return current.filter((id) => id !== evalRunId)
  }
  if (current.length >= MAX_COMPARE_SELECTION) {
    return current
  }
  return [...current, evalRunId]
}

// "/compare?left=13&right=12" -- left is whichever run was selected
// first, so the resulting comparison's side ordering matches click
// order rather than being arbitrary.
export function buildComparePath(selectedRunIds: number[]): string {
  const [left, right] = selectedRunIds
  return `/compare?left=${left}&right=${right}`
}
