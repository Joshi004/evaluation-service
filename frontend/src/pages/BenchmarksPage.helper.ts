// Non-DOM logic for BenchmarksPage.tsx: each card's own "has this been
// run, and how much" facts, built from GET /leaderboard's rows grouped
// by standard_id (docs/UI_REDESIGN_PLAN.md §8.12's own "Data sources"
// section) -- no extra endpoint, since a leaderboard row already
// carries every field a card needs.
import type { LeaderboardRow } from '../api/client'

export interface BenchmarkCardStats {
  modelsEvaluatedCount: number
  lastEvaluatedAt: string
  scoredSampleCount: number | null
}

function mostRecentRow(rows: LeaderboardRow[]): LeaderboardRow {
  return rows.reduce((latest, row) => (new Date(row.finished_at) > new Date(latest.finished_at) ? row : latest))
}

export function buildBenchmarkCardStatsByStandardId(rows: LeaderboardRow[]): Map<number, BenchmarkCardStats> {
  const rowsByStandardId = new Map<number, LeaderboardRow[]>()
  for (const row of rows) {
    const existingRows = rowsByStandardId.get(row.standard_id)
    if (existingRows) {
      existingRows.push(row)
    } else {
      rowsByStandardId.set(row.standard_id, [row])
    }
  }

  const statsByStandardId = new Map<number, BenchmarkCardStats>()
  for (const [standardId, standardRows] of rowsByStandardId) {
    const latestRow = mostRecentRow(standardRows)
    statsByStandardId.set(standardId, {
      modelsEvaluatedCount: new Set(standardRows.map((row) => row.checkpoint_id)).size,
      lastEvaluatedAt: latestRow.finished_at,
      scoredSampleCount: latestRow.n_samples,
    })
  }
  return statsByStandardId
}
