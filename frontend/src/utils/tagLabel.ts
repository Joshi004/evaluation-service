// Display labels for Phase 8's failure tags
// (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 8) -- shared between
// DiagnosticsSummary's clickable tag chips and SampleList's per-row
// tag badges, so a tag reads the same word in both places. Data, not
// per-tag branching: an unrecognized tag id falls back to the raw id
// rather than a lookup failure.
const TAG_LABELS: Record<string, string> = {
  near_miss: 'Near miss',
  complete_miss: 'Complete miss',
  recheck_disagrees: 'Recheck disagrees',
  cosmetic: 'Cosmetic',
  truncated: 'Truncated',
  empty: 'Empty',
  wrong_language: 'Wrong language',
}

export function tagLabel(tag: string): string {
  return TAG_LABELS[tag] ?? tag
}
