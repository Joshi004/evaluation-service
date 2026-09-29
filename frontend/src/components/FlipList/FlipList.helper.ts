// Non-DOM logic for FlipList.tsx: the collapse threshold, the
// per-sample score text, and whether a subset column is worth showing
// at all.
import type { FlipSample } from '../../api/client'

export const COLLAPSED_FLIP_ROWS = 10

// "0.00" / "1.00", or "—" when a sample's own scores dict somehow
// lacks the primary metric's key (FlipSample.left_score/right_score
// are optional for exactly that reason).
export function flipScoreText(score: number | null): string {
  return score === null ? '—' : score.toFixed(2)
}

export function flipListHeading(direction: 'fail_to_pass' | 'pass_to_fail', count: number): string {
  const arrow = direction === 'fail_to_pass' ? 'Fail → Pass' : 'Pass → Fail'
  return `${arrow} (${count})`
}

export function visibleFlipSamples(samples: FlipSample[], expanded: boolean): FlipSample[] {
  return expanded || samples.length <= COLLAPSED_FLIP_ROWS ? samples : samples.slice(0, COLLAPSED_FLIP_ROWS)
}

// True once either flip list carries more than one distinct subset --
// moved from ComparePage.helper.ts (Phase 9) to here (Phase 8,
// docs/UI_REDESIGN_PLAN.md §8.8) once CompareFlippedSamples became
// this function's only caller.
export function hasMultipleSubsets(failToPass: FlipSample[], passToFail: FlipSample[]): boolean {
  const subsets = new Set([...failToPass, ...passToFail].map((sample) => sample.subset))
  return subsets.size > 1
}
