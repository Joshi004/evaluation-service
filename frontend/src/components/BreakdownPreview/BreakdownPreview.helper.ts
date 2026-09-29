// Non-DOM logic for BreakdownPreview.tsx: which level to preview, how
// many rows, and the unit each level's count is really in. Kept out of
// the component body per .cursor/rules/frontend-components.mdc.

import type { DiagnosticsBucket } from '../../api/client'

export const RULE_LEVEL = 'rule'
const PREVIEW_ROW_LIMIT = 5

// "instructions" for the family and rule levels -- every instruction
// inside a bucket (buckets.py's own docstring); "samples" for MMLU-Pro's
// subject level, which groups whole samples rather than individual
// rules (sample_buckets_by_detail_field's own docstring: "n_instructions
// counts samples in the group here, not individual rules"). Labelling
// the unit is what keeps "0 of 12" from being misread as 12 samples
// when it is really 12 instructions, or the reverse.
const LEVEL_UNIT_LABELS: Record<string, string> = {
  family: 'instructions',
  rule: 'instructions',
  subject: 'samples',
}

export function unitLabelForLevel(level: string): string {
  return LEVEL_UNIT_LABELS[level] ?? 'instructions'
}

export interface BucketPreview {
  level: string
  rows: DiagnosticsBucket[]
}

// The rule level reads best for "where the points went" when it exists
// (the most specific breakdown); a benchmark without one (MMLU-Pro's
// subject-only breakdown) falls back to whichever level it does have.
// `buckets` already arrives grouped by level in the order the backend
// concatenated them and sorted by instructions lost within each level
// (buckets.py's sort_buckets) -- this never re-sorts, only picks which
// level's slice to show and truncates it to the top few.
export function previewBuckets(buckets: DiagnosticsBucket[]): BucketPreview | null {
  if (buckets.length === 0) {
    return null
  }
  const level = buckets.some((bucket) => bucket.level === RULE_LEVEL) ? RULE_LEVEL : buckets[0].level
  const rows = buckets.filter((bucket) => bucket.level === level).slice(0, PREVIEW_ROW_LIMIT)
  return { level, rows }
}

// "0 of 12 instructions" -- passed of total, labelled with the level's
// own unit rather than a bare "0/12" fraction.
export function bucketLostCountText(bucket: DiagnosticsBucket, unit: string): string {
  const passedText = bucket.passed === null ? '\u2014' : String(bucket.passed)
  return `${passedText} of ${bucket.n_instructions} ${unit}`
}
