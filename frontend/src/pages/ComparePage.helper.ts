// Non-DOM logic for ComparePage.tsx: the ?left=&right= URL contract,
// the run-picker's own label, and the score/delta/significance text the
// two score cards render (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md
// Phase 9). Kept out of the component body per
// .cursor/rules/frontend-components.mdc.

import type { ComparisonDelta, ComparisonSide, FlipSample, RunListItem } from '../api/client'
import { formatFractionAsPercent } from '../utils/formatFractionAsPercent'

export interface CompareParams {
  left: number | null
  right: number | null
}

// Reads left/right off the URL's query string. Either or both can be
// absent -- landing on a bare /compare (the nav item) shows two empty
// pickers rather than erroring; Phase 9's "the page reads ?left= and
// ?right= so it is linkable" doesn't require both to already be set.
export function parseCompareParams(params: URLSearchParams): CompareParams {
  return {
    left: parsePositiveInt(params.get('left')),
    right: parsePositiveInt(params.get('right')),
  }
}

function parsePositiveInt(value: string | null): number | null {
  if (value === null) {
    return null
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

// The inverse of parseCompareParams, for writing the URL back out when
// a picker changes.
export function toCompareParams(params: CompareParams): URLSearchParams {
  const searchParams = new URLSearchParams()
  if (params.left !== null) {
    searchParams.set('left', String(params.left))
  }
  if (params.right !== null) {
    searchParams.set('right', String(params.right))
  }
  return searchParams
}

// "#13 · ifeval · merged_global_step_810" -- what each <select> option
// reads. A bare run id means nothing to someone picking which two runs
// to compare.
export function runPickerLabel(run: RunListItem): string {
  return `#${run.id} \u00b7 ${run.benchmark} \u00b7 ${run.checkpoint_name}`
}

// Newest-first -- the runs someone wants to compare are almost always
// recent ones, and "#13, #12, #11…" is faster to scan than creation
// order once there are more than a handful of finished runs.
export function sortRunsForPicker(runs: RunListItem[]): RunListItem[] {
  return [...runs].sort((a, b) => b.id - a.id)
}

// Scores are stored as 0..1 fractions (docs/DATA_MODEL_V1.md) -- shown
// as a percentage, the same convention every other score in the app
// uses.
export function sideScoreText(side: ComparisonSide): string {
  return formatFractionAsPercent(side.value)
}

export function sideConfidenceIntervalText(side: ComparisonSide): string | null {
  if (side.confidence_interval === null) {
    return null
  }
  const lower = formatFractionAsPercent(side.confidence_interval.lower)
  const upper = formatFractionAsPercent(side.confidence_interval.upper)
  return `95% CI ${lower}\u2013${upper}`
}

// "+1.5 points" / "-2.0 points" -- signed, since a delta's direction is
// the entire point of this page. `right.value - left.value`, matching
// the backend's own ComparisonDelta.value.
export function deltaText(delta: ComparisonDelta): string {
  const points = delta.value * 100
  const sign = points > 0 ? '+' : ''
  return `${sign}${points.toFixed(1)} points`
}

// "not significant — inside the combined ±4.1pt interval" or the
// significant equivalent. docs/SCORE_DRILLDOWN_UI_PLAN.md Section 4:
// "A 1.3-point move at ±4 points is noise and the page should say so"
// -- this is that sentence, computed from the same two Wilson
// intervals the score cards already show.
export function significanceText(delta: ComparisonDelta): string {
  const combinedPoints = (delta.combined_half_width * 100).toFixed(1)
  return delta.is_significant
    ? `significant \u2014 outside the combined \u00b1${combinedPoints}pt interval`
    : `not significant \u2014 inside the combined \u00b1${combinedPoints}pt interval`
}

// Greys out a delta that isn't significant, the same "don't let noise
// read as progress" treatment Section 4's Layer 1 asks for on the
// leaderboard's own delta.
export function significanceClassName(delta: ComparisonDelta): string {
  return delta.is_significant ? 'text-slate-200' : 'text-slate-500'
}

// True once either flip list carries more than one distinct subset --
// RunComparison has no subsets list of its own (unlike RunDiagnostics),
// so this reads the signal off the one place a subset is actually
// carried, the same "hidden when the benchmark has only one" rule
// RunDiagnosticsPage applies to its own subset column.
export function hasMultipleSubsets(failToPass: FlipSample[], passToFail: FlipSample[]): boolean {
  const subsets = new Set([...failToPass, ...passToFail].map((sample) => sample.subset))
  return subsets.size > 1
}
