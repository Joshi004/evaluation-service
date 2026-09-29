// Score formatting for anywhere a fraction (0..1) is shown as a number
// a person reads -- the leaderboard, a run's headline, the ScoreValue
// domain component. Every function here defaults to percent with one
// decimal when the metric carries no display hint, and otherwise
// applies the hint's own multiplier, precision and unit
// (display_kind, display_multiplier, display_unit, display_precision --
// resolved server-side from the harness's own metric "semantics",
// app/schemas/diagnostics.py's MetricDisplay).
import type { ConfidenceInterval, MetricDisplay } from '../api/client'

// "85.4" -- no unit. formatScoreWithUnit below is the same computation
// with the unit appended; ScoreValue's `showUnit={false}` mode and the
// margin-of-error math both need the bare number.
export function formatScore(value: number, display: MetricDisplay | null = null): string {
  if (display === null) {
    return (value * 100).toFixed(1)
  }
  const scaled = value * (display.display_multiplier ?? 1)
  return scaled.toFixed(display.display_precision)
}

// "85.4%" -- replaces RunHealthBand.helper.ts's old formatMetricValue,
// which duplicated this exact computation before ScoreValue (Phase 4)
// became a second caller.
export function formatScoreWithUnit(value: number, display: MetricDisplay | null = null): string {
  if (display === null) {
    return `${formatScore(value, display)}%`
  }
  return `${formatScore(value, display)}${display.display_unit ?? ''}`
}

// "±3.0" -- half the interval's width, formatted the same way as the
// score itself so the two numbers always agree on unit and precision.
// `null` only when there is no interval to begin with (e.g. a metric
// with no n_samples yet), never a computed zero.
export function formatMargin(
  interval: ConfidenceInterval | null,
  display: MetricDisplay | null = null,
): string | null {
  if (interval === null) {
    return null
  }
  const halfWidth = (interval.upper - interval.lower) / 2
  return `\u00b1${formatScore(halfWidth, display)}`
}

// "−1.5 pts" -- a signed delta between two scores (e.g. a run report's
// "vs the previous run" line, Phase 8's own run-vs-baseline deltas).
// Always suffixed "pts", never the metric's own %/unit: the value being
// formatted is a *difference* of two percents, and showing it as
// "−1.5%" would read as "the score is 1.5%", not "the score moved by
// 1.5 points". Uses the typographic minus (U+2212), matching every
// other signed number in the redesign plan's own mockups.
export function formatScoreDelta(delta: number, display: MetricDisplay | null = null): string {
  const sign = delta < 0 ? '\u2212' : '+'
  return `${sign}${formatScore(Math.abs(delta), display)} pts`
}
