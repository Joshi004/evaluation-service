// Non-DOM logic for RunDiagnosticsPage.tsx: the URL query string's
// contract (docs/SCORE_DRILLDOWN_EXECUTION_PHASES.md Phase 4 says
// "filter state lives in the URL query string, not component state" --
// a filtered view has to be shareable) and the GET /samples request it
// builds. Kept out of the component body per
// .cursor/rules/frontend-components.mdc.

// Capped well under the API's own limit=200 max (Section 3.5) -- a
// page this size keeps the table readable and the request small.
export const SAMPLE_PAGE_SIZE = 50

// Mirrors the API's `passed` filter, plus the "don't filter on it at
// all" case the API expresses as an absent query parameter.
export type SampleOutcome = 'failed' | 'passed' | 'all'

export interface SampleListFilters {
  outcome: SampleOutcome
  subset: string | null
  // A rule id a sample carries (Section 3.5), e.g.
  // "length_constraints:nth_paragraph_first_word" -- set by clicking a
  // rule row in FailureBreakdown (Phase 6). `null` means no rule
  // filter, matching every other optional filter here.
  rule: string | null
  // A tag a sample carries (Phase 8), e.g. "near_miss" -- set by
  // clicking a chip in DiagnosticsSummary. `null` means no tag filter.
  tag: string | null
  q: string
  offset: number
}

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

// Builds the GET /runs/{id}/samples path (Section 3.5's query
// parameters). Uses URLSearchParams rather than string concatenation
// throughout -- MMLU-Pro subset names contain a literal space
// ("computer science"), and `q` is free-text user input.
export function buildSamplesPath(runId: number, filters: SampleListFilters): string {
  const params = new URLSearchParams()
  if (filters.outcome === 'failed') {
    params.set('passed', 'false')
  } else if (filters.outcome === 'passed') {
    params.set('passed', 'true')
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
  params.set('limit', String(SAMPLE_PAGE_SIZE))
  params.set('offset', String(filters.offset))
  return `/runs/${runId}/samples?${params.toString()}`
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
