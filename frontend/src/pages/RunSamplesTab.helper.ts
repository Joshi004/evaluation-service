// Non-DOM logic for RunSamplesTab.tsx: the URL query string's contract
// (moved verbatim from the deleted RunDiagnosticsPage.helper.ts, Phase
// 7 -- "filter state lives in the URL query string, not component
// state" still holds: a filtered view has to be shareable) plus the
// cross-page Prev/Next stepping this merged tab now needs on top of it.

import type { DiagnosticsSample } from '../api/client'
import type { SampleListFilters, SampleOutcome } from '../api/queries/runDiagnostics'

// "Defaults to failures only" without needing a param in the plain URL
// -- an absent `outcome` reads as `'failed'`, not `'all'`.
const DEFAULT_OUTCOME: SampleOutcome = 'failed'

function isSampleOutcome(value: string | null): value is SampleOutcome {
  return value === 'failed' || value === 'passed' || value === 'all'
}

// Reads the six filter fields off the URL's query string (`outcome`,
// `subset`, `rule`, `tag`, `q`, `offset` -- Appendix A, frozen). Every
// field has a safe fallback, so a hand-edited or stale URL (an
// unrecognised `outcome`, a negative `offset`) degrades to the default
// view instead of throwing.
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
// `/runs/13/samples` should read as a clean URL, not
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

export type SampleStep =
  | { kind: 'same-page'; sampleKey: string }
  | { kind: 'other-page'; offset: number; position: 'first' | 'last' }
  | { kind: 'unavailable' }

// Where Prev/Next (or `j`/`k`) should land next, from the *currently
// loaded page's* own items -- `'other-page'` tells the caller which
// page to fetch and which end of it to open, keeping the URL's own
// `offset` in sync with whichever page the panel actually lands on --
// paging semantics must stay correct when Prev/Next crosses a page
// boundary. `'unavailable'` covers both "no more results in that
// direction" and "the open sample isn't even on this page" (a filter
// changed while the panel stayed open) -- the caller tells the two
// apart by checking whether `sampleKey` itself appears in `items`.
export function resolveSampleStep(
  direction: 'next' | 'previous',
  items: DiagnosticsSample[],
  sampleKey: string,
  offset: number,
  total: number,
  pageSize: number,
): SampleStep {
  const index = items.findIndex((item) => item.sample_key === sampleKey)
  if (index === -1) {
    return { kind: 'unavailable' }
  }
  if (direction === 'next') {
    if (index < items.length - 1) {
      return { kind: 'same-page', sampleKey: items[index + 1].sample_key }
    }
    const nextOffset = offset + pageSize
    return nextOffset < total ? { kind: 'other-page', offset: nextOffset, position: 'first' } : { kind: 'unavailable' }
  }
  if (index > 0) {
    return { kind: 'same-page', sampleKey: items[index - 1].sample_key }
  }
  const previousOffset = offset - pageSize
  return previousOffset >= 0
    ? { kind: 'other-page', offset: previousOffset, position: 'last' }
    : { kind: 'unavailable' }
}

// True for a keydown that should never trigger a single-letter shortcut
// -- typing into the search box, a modifier combination (browser/OS
// shortcuts like Cmd+K), or a key some other handler already claimed.
export function shouldIgnoreShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
    return true
  }
  const target = event.target
  if (!(target instanceof HTMLElement)) {
    return false
  }
  const tagName = target.tagName
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable
}
