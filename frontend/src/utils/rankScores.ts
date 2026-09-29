// The one rank helper (docs/UI_REDESIGN_PLAN.md Phase 6, Appendix A:
// "Rank helper (rankScores...) | 6 | 7, 11" -- the Leaderboard, a run
// report's "#N of M" line and the Model page's scorecard must never
// disagree about a run's rank, so all three read this instead of each
// computing their own.
import type { LeaderboardRow } from '../api/client'
import { intervalsOverlap } from './intervalsOverlap'

export interface RankedScore {
  row: LeaderboardRow
  // 1-based; a tie shares a rank rather than being split by an
  // arbitrary secondary key (e.g. finished_at) -- §3 rule 4 treats two
  // equal scores as equal, not as one edging out the other.
  rank: number
  isLeader: boolean
  // True for a non-leader row whose interval overlaps the leader's --
  // what a caller renders as "≈" (By-benchmark lens) or folds into a ★
  // alongside isLeader (Overview lens). Never true for the leader
  // itself, which is isLeader instead.
  withinLeaderMargin: boolean
}

// Keeps the latest result per checkpoint for one comparison_hash --
// defensive, not load-bearing against GET /leaderboard today (its own
// DISTINCT ON already guarantees at most one row per (checkpoint,
// comparison_hash)), but this function's callers narrow a wider row
// set (e.g. Phase 7's "every result on this setup", sourced from
// GET /runs) that carries no such guarantee.
function latestRowPerCheckpoint(rows: LeaderboardRow[]): LeaderboardRow[] {
  const latestByCheckpoint = new Map<number, LeaderboardRow>()
  for (const row of rows) {
    const current = latestByCheckpoint.get(row.checkpoint_id)
    if (!current || new Date(row.finished_at) > new Date(current.finished_at)) {
      latestByCheckpoint.set(row.checkpoint_id, row)
    }
  }
  return [...latestByCheckpoint.values()]
}

// Ranks every checkpoint's latest result on one setup (comparison_hash),
// best first under `higherIsBetter`. Empty input (no rows on this
// setup) returns an empty list rather than throwing, so a caller can
// call this unconditionally and just check `.length`.
export function rankScores(
  rows: LeaderboardRow[],
  comparisonHash: string,
  higherIsBetter: boolean,
): RankedScore[] {
  const setupRows = latestRowPerCheckpoint(rows.filter((row) => row.comparison_hash === comparisonHash))
  if (setupRows.length === 0) {
    return []
  }

  const isBetter = (a: LeaderboardRow, b: LeaderboardRow): boolean =>
    higherIsBetter ? a.metric_value > b.metric_value : a.metric_value < b.metric_value

  const sorted = [...setupRows].sort((a, b) => {
    if (isBetter(a, b)) return -1
    if (isBetter(b, a)) return 1
    return 0
  })
  // Arbitrary among ties for rank 1, but only ever used for its own
  // interval below -- every rank-1 row is `isLeader` regardless of
  // which one this picks.
  const leader = sorted[0]

  return sorted.map((row) => {
    const rank = 1 + sorted.filter((candidate) => isBetter(candidate, row)).length
    const withinLeaderMargin =
      rank !== 1 &&
      row.confidence_interval !== null &&
      leader.confidence_interval !== null &&
      intervalsOverlap(row.confidence_interval, leader.confidence_interval)
    return { row, rank, isLeader: rank === 1, withinLeaderMargin }
  })
}
