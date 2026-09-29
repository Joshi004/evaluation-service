// Non-DOM logic for RunStandingLines.tsx: this run's own standing
// against its peers (rank) and its own history (movement vs the
// previous run of this model on this setup). Kept out of the component
// body per .cursor/rules/frontend-components.mdc.

import type { LeaderboardRow, MetricDisplay, RunDetail, RunListItem } from '../../api/client'
import { formatScoreDelta } from '../../utils/formatScore'
import { intervalsOverlap } from '../../utils/intervalsOverlap'
import { rankScores } from '../../utils/rankScores'

export type RankStanding =
  | { kind: 'unavailable' }
  | { kind: 'superseded'; byRunId: number }
  | { kind: 'solo' }
  | { kind: 'ranked'; rank: number; total: number; comparedRank: number | null }

// This run's own standing on the leaderboard's latest-per-model view --
// computed with the same rankScores helper the Leaderboard itself uses
// (Appendix A), so this line and that table can never disagree.
// 'unavailable' (rendered as no line at all, not an error) covers both
// a genuinely missing row and a stale one: the leaderboard's cached row
// for this (checkpoint, setup) pair predating this run's own finish
// time means the cache hasn't caught up yet, and treating that as
// "superseded by an older run" would be actively wrong, not just
// approximate.
export function resolveRankStanding(
  run: RunDetail,
  leaderboardRows: LeaderboardRow[],
  higherIsBetter: boolean,
): RankStanding {
  const currentRow = leaderboardRows.find(
    (row) => row.checkpoint_id === run.checkpoint_id && row.comparison_hash === run.comparison_hash,
  )
  if (currentRow === undefined || run.finished_at === null) {
    return { kind: 'unavailable' }
  }
  if (new Date(currentRow.finished_at) < new Date(run.finished_at)) {
    return { kind: 'unavailable' }
  }
  if (currentRow.eval_run_id !== run.id) {
    return { kind: 'superseded', byRunId: currentRow.eval_run_id }
  }

  const ranked = rankScores(leaderboardRows, run.comparison_hash, higherIsBetter)
  if (ranked.length <= 1) {
    return { kind: 'solo' }
  }
  const own = ranked.find((entry) => entry.row.checkpoint_id === run.checkpoint_id)
  if (own === undefined) {
    return { kind: 'unavailable' }
  }
  // The leader's own line names the closest rival (the lowest rank
  // among rows within its margin), if any; a non-leader row's line
  // names the leader (always rank 1) only when it is itself within that
  // margin -- one rule produces both directions of "#N of M ...,
  // within margin of #K".
  const comparedRank = own.isLeader
    ? (ranked.find((entry) => entry.withinLeaderMargin)?.rank ?? null)
    : own.withinLeaderMargin
      ? 1
      : null
  return { kind: 'ranked', rank: own.rank, total: ranked.length, comparedRank }
}

// "#1 of 2 on this setup, within margin of #2" -- the acceptance
// criteria's own exact wording (docs/UI_REDESIGN_PLAN.md §8.7). `null`
// for 'unavailable' and 'superseded': the component renders those two
// cases itself (the latter as a link to the superseding run), not as
// plain text from here.
export function rankStandingText(standing: RankStanding): string | null {
  switch (standing.kind) {
    case 'unavailable':
    case 'superseded':
      return null
    case 'solo':
      return 'Only model evaluated on this setup'
    case 'ranked':
      return standing.comparedRank === null
        ? `#${standing.rank} of ${standing.total} on this setup`
        : `#${standing.rank} of ${standing.total} on this setup, within margin of #${standing.comparedRank}`
  }
}

// The most recent other `done` run of this same model on this same
// setup, finished strictly before `run` -- "previous" means
// chronologically earlier, independent of whether the leaderboard still
// considers it current (a superseded run still has its own previous
// run).
export function resolvePreviousRun(run: RunDetail, sameSetupRuns: RunListItem[]): RunListItem | null {
  if (run.finished_at === null) {
    return null
  }
  const runFinishedAt = new Date(run.finished_at).getTime()
  const before = sameSetupRuns.filter(
    (candidate) =>
      candidate.id !== run.id &&
      candidate.finished_at !== null &&
      new Date(candidate.finished_at).getTime() < runFinishedAt,
  )
  if (before.length === 0) {
    return null
  }
  return before.reduce((latest, candidate) =>
    // Non-null by construction: every entry in `before` passed the
    // `finished_at !== null` filter above.
    new Date(candidate.finished_at as string).getTime() > new Date(latest.finished_at as string).getTime()
      ? candidate
      : latest,
  )
}

export interface MovementText {
  text: string
  previousRunId: number
}

// "−1.5 pts vs the previous run of this model on this setup (#11),
// within margin of error" -- `null` only if either run's primary metric
// value is genuinely missing (not expected for two `done` runs, but
// cheaper to guard than to crash on it). The component renders "First
// run of this model on this setup" itself when there is no previous run
// at all, so this is only ever called once one exists.
export function buildMovementText(
  run: RunDetail,
  previousRun: RunListItem,
  display: MetricDisplay | null,
): MovementText | null {
  const primaryMetric = run.performance?.metrics.find((metric) => metric.is_primary)
  if (primaryMetric === undefined || previousRun.primary_metric_value === null) {
    return null
  }
  const delta = primaryMetric.value - previousRun.primary_metric_value
  const withinMargin =
    primaryMetric.confidence_interval !== null &&
    previousRun.primary_metric_confidence_interval !== null &&
    intervalsOverlap(primaryMetric.confidence_interval, previousRun.primary_metric_confidence_interval)
  const marginSuffix = withinMargin ? ', within margin of error' : ''
  return {
    text: `${formatScoreDelta(delta, display)} vs the previous run of this model on this setup (#${previousRun.id})${marginSuffix}`,
    previousRunId: previousRun.id,
  }
}
