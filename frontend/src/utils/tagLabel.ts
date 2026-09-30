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

// One-line definitions paraphrased from the backend's own written
// summary (app/services/diagnostics/narrate.py's _severity_sentence
// and _cause_sentences) -- not invented here, since a wrong guess
// about what a tag means is worse than no tooltip. `null` for a tag
// with no entry (a future tag added before its own hint lands here),
// so a caller renders that chip without a tooltip rather than a made-up
// one.
const TAG_HINTS: Record<string, string> = {
  near_miss: 'The model followed some of the question\u2019s rules and broke the rest.',
  complete_miss: 'Every rule on the question was broken.',
  recheck_disagrees:
    'A recheck found every rule passing on a sample the harness scored as failed -- the harness score stays authoritative.',
  cosmetic: 'Passes the forgiving checker and fails only the strict one -- the content was right, the wrapper was wrong.',
  truncated: 'Cut off at the token limit -- a mechanical failure, not a model one.',
  empty: 'Came back empty -- usually a request error rather than a model failure.',
  wrong_language: 'Answered in the wrong language.',
}

export function tagHint(tag: string): string | null {
  return TAG_HINTS[tag] ?? null
}
