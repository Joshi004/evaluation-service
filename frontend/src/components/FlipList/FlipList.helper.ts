// Non-DOM logic for FlipList.tsx: the collapse threshold and the
// per-sample score text a flip row shows for each side.
// (.cursor/rules/frontend-components.mdc.)

import type { FlipSample } from '../../api/client'

// The table's collapsed height before "Show all N" is clicked --
// mirrors FailureBreakdown's own COLLAPSED_RULE_ROWS idiom
// (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 9 reuses Phase 6's
// pattern rather than inventing a second one).
export const COLLAPSED_FLIP_ROWS = 10

// "0.00" / "1.00", or "—" when a sample's own scores dict somehow
// lacks the primary metric's key (FlipSample.left_score/right_score
// are optional for exactly that reason). Matches SampleList's own
// primaryScoreText precision.
export function flipScoreText(score: number | null): string {
  return score === null ? '\u2014' : score.toFixed(2)
}

// "Fail → Pass (26)" / "Pass → Fail (18)" -- the section heading, with
// the count visible without expanding the table.
export function flipListHeading(direction: 'fail_to_pass' | 'pass_to_fail', count: number): string {
  const arrow = direction === 'fail_to_pass' ? 'Fail \u2192 Pass' : 'Pass \u2192 Fail'
  return `${arrow} (${count})`
}

export function visibleFlipSamples(samples: FlipSample[], expanded: boolean): FlipSample[] {
  return expanded || samples.length <= COLLAPSED_FLIP_ROWS
    ? samples
    : samples.slice(0, COLLAPSED_FLIP_ROWS)
}
