// Non-DOM logic for RunDiagnosticsPage.tsx: the URL query string's
// contract (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 4 says
// "filter state lives in the URL query string, not component state" --
// a filtered view has to be shareable) and this page's own display
// text. The request-building side of the filter contract
// (SampleOutcome, SampleListFilters, SAMPLE_PAGE_SIZE, buildSamplesPath)
// moved to api/queries/runDiagnostics.ts in Phase 4, since that's the
// half a query hook actually needs; this file keeps only what's
// specific to reading and writing this page's own URL.
import type { SampleListFilters, SampleOutcome } from '../api/queries/runDiagnostics'

// "Defaults to failures only" (Phase 4's goal) without needing a
// param in the plain URL -- an absent `outcome` reads as `'failed'`,
// not `'all'`.
const DEFAULT_OUTCOME: SampleOutcome = 'failed'

function isSampleOutcome(value: string | null): value is SampleOutcome {
  return value === 'failed' || value === 'passed' || value === 'all'
}

// Reads the five filter fields off the URL's query string. Every field
// has a safe fallback, so a hand-edited or stale URL (an unrecognised
// `outcome`, a negative `offset`) degrades to the default view instead
// of throwing.
export function parseSampleFilters(params: URLSearchParams): SampleListFilters {
  const outcomeParam = params.get('outcome')
  const offsetParam = Number.parseInt(params.get('offset') ?? '', 10)

  return {
    outcome: isSampleOutcome(outcomeParam) ? outcomeParam : DEFAULT_OUTCOME,
    subset: params.get('subset'),
    rule: params.get('rule'),
    tag: params.get('tag'),
    q: params.get('q') ?? '',
    offset: Number.isFinite(offsetParam) && offsetParam > 0 ? offsetParam : 0,
  }
}

// The inverse of parseSampleFilters, for writing the URL back out.
// Omits every field at its default value -- a freshly loaded
// `/runs/13/diagnostics` should read as a clean URL, not
// `?outcome=failed&subset=&q=&offset=0`.
export function toSearchParams(filters: SampleListFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.outcome !== DEFAULT_OUTCOME) {
    params.set('outcome', filters.outcome)
  }
  if (filters.subset !== null) {
    params.set('subset', filters.subset)
  }
  if (filters.rule !== null) {
    params.set('rule', filters.rule)
  }
  if (filters.tag !== null) {
    params.set('tag', filters.tag)
  }
  if (filters.q !== '') {
    params.set('q', filters.q)
  }
  if (filters.offset !== 0) {
    params.set('offset', String(filters.offset))
  }
  return params
}

// "Showing 1-50 of 79" -- the pager's own label, and also what makes
// `total` verifiable against what's actually on screen rather than a
// number the reader has to trust blindly.
export function buildRangeText(total: number, offset: number, shownCount: number): string {
  if (shownCount === 0) {
    return `Showing 0 of ${total}`
  }
  const from = offset + 1
  const to = offset + shownCount
  return `Showing ${from}\u2013${to} of ${total}`
}
