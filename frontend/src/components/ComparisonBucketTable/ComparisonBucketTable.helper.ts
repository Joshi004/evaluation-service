// Non-DOM logic for ComparisonBucketTable.tsx: merging N runs' own
// bucket_deltas (each still just baseline-vs-one-other, from the
// pairwise endpoint) into one table with a column per other run, plus
// the level selector's own available options and default.
import type { ComparisonBucketDelta, RunDetail } from '../../api/client'
import type { ComparePairState } from '../../utils/compareRuns'

export const DEFAULT_BUCKET_LEVEL = 'rule'
const SAMPLE_COUNTED_LEVEL = 'subject'
export const COLLAPSED_BUCKET_ROWS = 10

export interface ComparableBucketPair {
  otherRun: RunDetail
  deltas: ComparisonBucketDelta[]
}

// Every pair whose comparison actually succeeded and produced buckets
// -- a refused, still-loading or errored pair contributes nothing here
// rather than a row of dashes.
export function comparableBucketPairs(pairs: ComparePairState[]): ComparableBucketPair[] {
  const result: ComparableBucketPair[] = []
  for (const pair of pairs) {
    if (pair.status === 'loaded' && pair.comparison?.comparable) {
      result.push({ otherRun: pair.run, deltas: pair.comparison.bucket_deltas })
    }
  }
  return result
}

export function availableBucketLevels(pairs: ComparableBucketPair[]): string[] {
  const levels = new Set<string>()
  for (const pair of pairs) {
    for (const delta of pair.deltas) {
      levels.add(delta.level)
    }
  }
  return [...levels].sort()
}

// 'rule' when it's on offer (every IFEval/IFBench breakdown has it);
// otherwise whatever the data actually has, so a benchmark with only
// "subject" buckets (MMLU-Pro) doesn't default to an empty table.
export function resolveBucketLevel(requestedLevel: string | null, availableLevels: string[]): string | null {
  if (requestedLevel !== null && availableLevels.includes(requestedLevel)) {
    return requestedLevel
  }
  if (availableLevels.includes(DEFAULT_BUCKET_LEVEL)) {
    return DEFAULT_BUCKET_LEVEL
  }
  return availableLevels[0] ?? null
}

// MMLU-Pro's "subject" buckets tally samples
// (backend/app/services/diagnostics/buckets.py's
// sample_buckets_by_detail_field); "family"/"rule" (IFEval/IFBench)
// tally instructions -- label the unit so a row is never read as
// samples that add up to the total, still true once merged across
// runs.
export function bucketUnitLabel(level: string): string {
  return level === SAMPLE_COUNTED_LEVEL ? 'samples' : 'instructions'
}

export interface MergedBucketRow {
  name: string
  baselinePassRate: number | null
  // One entry per other run, in the same order comparableBucketPairs
  // produced them -- `null` when that run's own comparison didn't
  // produce this bucket at all.
  perRun: { runId: number; delta: number | null }[]
  maxAbsDelta: number
}

export function buildMergedBucketRows(pairs: ComparableBucketPair[], level: string): MergedBucketRow[] {
  const rowsByName = new Map<string, MergedBucketRow>()

  for (const pair of pairs) {
    for (const delta of pair.deltas) {
      if (delta.level !== level) {
        continue
      }
      const row = rowsByName.get(delta.name) ?? {
        name: delta.name,
        baselinePassRate: null,
        perRun: [],
        maxAbsDelta: 0,
      }
      if (row.baselinePassRate === null) {
        row.baselinePassRate = delta.left_pass_rate
      }
      row.perRun.push({ runId: pair.otherRun.id, delta: delta.pass_rate_delta })
      if (delta.pass_rate_delta !== null) {
        row.maxAbsDelta = Math.max(row.maxAbsDelta, Math.abs(delta.pass_rate_delta))
      }
      rowsByName.set(delta.name, row)
    }
  }

  return [...rowsByName.values()].sort((a, b) => b.maxAbsDelta - a.maxAbsDelta || a.name.localeCompare(b.name))
}

export function visibleBucketRows(rows: MergedBucketRow[], expanded: boolean): MergedBucketRow[] {
  return expanded || rows.length <= COLLAPSED_BUCKET_ROWS ? rows : rows.slice(0, COLLAPSED_BUCKET_ROWS)
}
