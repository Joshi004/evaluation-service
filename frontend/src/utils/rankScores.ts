// The one rank helper -- the Leaderboard, a run report's "#N of M"
// line and the Model page's scorecard must never disagree about a
// run's rank, so all three read this instead of each computing their
// own.
import type { ConfidenceInterval, LeaderboardRow } from '../api/client'
import { intervalsOverlap } from './intervalsOverlap'

// What every ranking shares, whatever is being ranked (a raw
// leaderboard row on one setup, or a model's best result across
// setups -- buildLeaderboard.ts's own buildBestResults).
export interface RankedItem<T> {
  item: T
  // 1-based; a tie shares a rank rather than being split by an
  // arbitrary secondary key (e.g. finished_at) -- two equal scores are
  // treated as equal, not as one edging out the other.
  rank: number
  isLeader: boolean
  // True for a non-leader item whose interval overlaps the leader's --
  // what a caller renders as "≈" (By-benchmark lens) or folds into a ★
  // alongside isLeader (Overview lens). Never true for the leader
  // itself, which is isLeader instead.
  withinLeaderMargin: boolean
}

// Ranks any list of scored items best first under `higherIsBetter`.
// Empty input returns an empty list rather than throwing, so a caller
// can call this unconditionally and just check `.length`.
export function rankItems<T>(
  items: T[],
  higherIsBetter: boolean,
  valueOf: (item: T) => number,
  intervalOf: (item: T) => ConfidenceInterval | null,
): RankedItem<T>[] {
  if (items.length === 0) {
    return []
  }

  const isBetter = (a: T, b: T): boolean =>
    higherIsBetter ? valueOf(a) > valueOf(b) : valueOf(a) < valueOf(b)

  const sorted = [...items].sort((a, b) => {
    if (isBetter(a, b)) return -1
    if (isBetter(b, a)) return 1
    return 0
  })
  // Arbitrary among ties for rank 1, but only ever used for its own
  // interval below -- every rank-1 item is `isLeader` regardless of
  // which one this picks.
  const leader = sorted[0]
  const leaderInterval = intervalOf(leader)

  return sorted.map((item) => {
    const rank = 1 + sorted.filter((candidate) => isBetter(candidate, item)).length
    const itemInterval = intervalOf(item)
    const withinLeaderMargin =
      rank !== 1 &&
      itemInterval !== null &&
      leaderInterval !== null &&
      intervalsOverlap(itemInterval, leaderInterval)
    return { item, rank, isLeader: rank === 1, withinLeaderMargin }
  })
}

export interface RankedScore {
  row: LeaderboardRow
  rank: number
  isLeader: boolean
  withinLeaderMargin: boolean
}

// Keeps the latest result per checkpoint for one comparison_hash --
// defensive, not load-bearing against GET /leaderboard today (its own
// DISTINCT ON already guarantees at most one row per (checkpoint,
// comparison_hash)), but this function's callers narrow a wider row
// set (e.g. "every result on this setup", sourced from GET /runs) that
// carries no such guarantee.
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
  return rankItems(
    setupRows,
    higherIsBetter,
    (row) => row.metric_value,
    (row) => row.confidence_interval,
  ).map(({ item, rank, isLeader, withinLeaderMargin }) => ({ row: item, rank, isLeader, withinLeaderMargin }))
}
