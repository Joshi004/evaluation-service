// One colour per run in a comparison, assigned by position (baseline
// first) rather than by anything about the run itself, so "Make
// baseline" (which just reorders ?runs=) never recolours a run that
// didn't move -- Phase 8, docs/UI_REDESIGN_PLAN.md §8.8. Shared by
// CompareHeader (chip dots), CompareScoreMatrix (row dots and forest
// whiskers) and CompareSampleDialog (column dots), so the same run
// always reads as the same colour everywhere on the page.
//
// Written out literally, not built from a template string: Tailwind's
// build-time scanner only recognises complete class names appearing as
// literal text in source (the same constraint StyleguidePage.tsx's own
// SERIES_SWATCH_CLASSES documents).
const SERIES_TEXT_CLASSES = ['text-series-1', 'text-series-2', 'text-series-3', 'text-series-4'] as const
const SERIES_BG_CLASSES = ['bg-series-1', 'bg-series-2', 'bg-series-3', 'bg-series-4'] as const

export function seriesTextClassName(index: number): string {
  return SERIES_TEXT_CLASSES[index % SERIES_TEXT_CLASSES.length]
}

export function seriesBgClassName(index: number): string {
  return SERIES_BG_CLASSES[index % SERIES_BG_CLASSES.length]
}
