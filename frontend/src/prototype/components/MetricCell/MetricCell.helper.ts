import type { EvalRun } from '../../data/types'

export type MetricCellTone = 'standard' | 'exploratory' | 'flagged'

/** Exploratory and flagged are both worth calling out visually; flagged (a diagnostic threshold was crossed) takes priority. */
export function getCellTone(run: EvalRun): MetricCellTone {
  if (run.flaggedReason) return 'flagged'
  if (!run.isStandard) return 'exploratory'
  return 'standard'
}

export function getCellTitle(run: EvalRun): string {
  if (run.flaggedReason) return run.flaggedReason
  if (!run.isStandard) return 'Exploratory run — not on the standard leaderboard. Click for methodology.'
  return 'Click for methodology'
}
