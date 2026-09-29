import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query'
import {
  apiFetch,
  type DiagnosticsSampleDetail,
  type RunComparison,
  type RunDiagnostics,
  type SamplePage,
} from '../client'
import { queryKeys } from './queryKeys'

// Mirrors the API's `passed` filter, plus the "don't filter on it at
// all" case the API expresses as an absent query parameter. Lives here,
// not in RunDiagnosticsPage.helper.ts, because it's part of the request
// this hook builds -- that page's own helper keeps only its URL-reading
// and display logic (parseSampleFilters, toSearchParams, buildRangeText).
export type SampleOutcome = 'failed' | 'passed' | 'all'

export interface SampleListFilters {
  outcome: SampleOutcome
  subset: string | null
  // A rule id a sample carries, e.g.
  // "length_constraints:nth_paragraph_first_word". `null` means no
  // rule filter, matching every other optional filter here.
  rule: string | null
  // A tag a sample carries, e.g. "near_miss". `null` means no tag
  // filter.
  tag: string | null
  q: string
  offset: number
}

// Capped well under the API's own limit=200 max -- a page this size
// keeps the table readable and the request small.
export const SAMPLE_PAGE_SIZE = 50

// Builds the GET /runs/{id}/samples path. Uses URLSearchParams
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

export function useRunDiagnostics(runId: number): UseQueryResult<RunDiagnostics> {
  return useQuery({
    queryKey: queryKeys.runDiagnostics(runId),
    queryFn: () => apiFetch<RunDiagnostics>(`/runs/${runId}/diagnostics`),
    enabled: Number.isFinite(runId),
  })
}

export function useRunSamples(runId: number, filters: SampleListFilters): UseQueryResult<SamplePage> {
  return useQuery({
    queryKey: queryKeys.runSamples(runId, filters),
    queryFn: () => apiFetch<SamplePage>(buildSamplesPath(runId, filters)),
    enabled: Number.isFinite(runId),
    // Keeps the previous page's rows on screen while a filter change or
    // a page turn is in flight, instead of flashing an empty table.
    placeholderData: keepPreviousData,
  })
}

export function useRunSample(
  runId: number,
  sampleKey: string | undefined,
): UseQueryResult<DiagnosticsSampleDetail> {
  return useQuery({
    queryKey: queryKeys.runSample(runId, sampleKey),
    queryFn: () =>
      apiFetch<DiagnosticsSampleDetail>(`/runs/${runId}/samples/${encodeURIComponent(sampleKey ?? '')}`),
    enabled: Number.isFinite(runId) && sampleKey !== undefined,
    // A 404 here means this sample_key doesn't exist on this run --
    // retrying it three times with backoff (the QueryClient default)
    // would only delay the clear not-found state, with no chance the
    // third attempt succeeds where the first didn't.
    retry: false,
  })
}

export function useRunComparison(
  leftRunId: number | null,
  rightRunId: number | null,
): UseQueryResult<RunComparison> {
  return useQuery({
    queryKey: queryKeys.runComparison(leftRunId, rightRunId),
    queryFn: () => apiFetch<RunComparison>(`/runs/${leftRunId}/compare/${rightRunId}`),
    enabled: leftRunId !== null && rightRunId !== null,
    // A 404 (unknown run) or 409 (not finished) won't succeed on a
    // third attempt -- retrying would only delay the error state.
    retry: false,
  })
}
