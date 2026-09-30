import { keepPreviousData, queryOptions, useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query'
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

export interface UseRunDiagnosticsOptions {
  // The diagnostics endpoint 409s for a queued, running, failed or
  // cancelled run. Callers that already know the run's status
  // (RunReportPage, once per run) pass `enabled: run.status === 'done'`;
  // defaults to `true` so existing call sites (a page that only ever
  // mounts for a finished run) don't need to change.
  enabled?: boolean
}

export function useRunDiagnostics(
  runId: number,
  options: UseRunDiagnosticsOptions = {},
): UseQueryResult<RunDiagnostics> {
  return useQuery({
    queryKey: queryKeys.runDiagnostics(runId),
    queryFn: () => apiFetch<RunDiagnostics>(`/runs/${runId}/diagnostics`),
    enabled: Number.isFinite(runId) && (options.enabled ?? true),
  })
}

// Factored out of useRunSamples so a Prev/Next that needs the next page
// of samples (RunSamplesTab, crossing a SAMPLE_PAGE_SIZE boundary) can
// pull it through the same query the list itself uses --
// `queryClient.query(runSamplesQueryOptions(...))` populates the exact
// cache entry useRunSamples would read on the next render, instead of a
// second, differently-keyed fetch.
export function runSamplesQueryOptions(runId: number, filters: SampleListFilters) {
  return queryOptions({
    queryKey: queryKeys.runSamples(runId, filters),
    queryFn: () => apiFetch<SamplePage>(buildSamplesPath(runId, filters)),
  })
}

export function useRunSamples(runId: number, filters: SampleListFilters): UseQueryResult<SamplePage> {
  return useQuery({
    ...runSamplesQueryOptions(runId, filters),
    enabled: Number.isFinite(runId),
    // Keeps the previous page's rows on screen while a filter change or
    // a page turn is in flight, instead of flashing an empty table.
    placeholderData: keepPreviousData,
  })
}

// Factored out of useRunSample so Compare's own side-by-side dialog can
// fetch one sample from several runs in parallel through the exact
// same options -- each run is its own cache entry (queryKeys.runSample),
// shared with this run's own Samples tab.
export function runSampleQueryOptions(runId: number, sampleKey: string | undefined) {
  return queryOptions({
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

export function useRunSample(
  runId: number,
  sampleKey: string | undefined,
): UseQueryResult<DiagnosticsSampleDetail> {
  return useQuery(runSampleQueryOptions(runId, sampleKey))
}

// Compare's side-by-side dialog: the same sample_key, read
// off every compared run at once -- a 404 on one side (the flip's own
// baseline, or a run that never produced this key) is that column's
// own not-found state, not a reason to fail every other column.
export function useSampleAcrossRuns(
  runIds: number[],
  sampleKey: string | undefined,
): UseQueryResult<DiagnosticsSampleDetail>[] {
  return useQueries({ queries: runIds.map((runId) => runSampleQueryOptions(runId, sampleKey)) })
}

// Baseline vs one other run -- see app/services/diagnostics/compare.py.
// `baselineRunId` is always the request's own left side, so
// delta.value (right - left) already carries the right sign for "the
// other run vs the baseline" with no sign-flipping at any call site.
export function runComparisonQueryOptions(baselineRunId: number, otherRunId: number) {
  return queryOptions({
    queryKey: queryKeys.runComparison(baselineRunId, otherRunId),
    queryFn: () => apiFetch<RunComparison>(`/runs/${baselineRunId}/compare/${otherRunId}`),
    // A 404 (unknown run) or 409 (not finished) won't succeed on a
    // third attempt -- retrying would only delay the error state. Both
    // are pre-empted in practice: Compare only ever calls this with
    // ids it already confirmed are `done` via useRunsById.
    retry: false,
  })
}

// Compare's own N-way join: the baseline against every other
// pinned run, in parallel -- at most 3 requests (MAX_COMPARE_RUNS - 1),
// each independently cached so switching which run is the baseline
// only issues requests for pairs not already seen.
export function useRunComparisons(
  baselineRunId: number,
  otherRunIds: number[],
): UseQueryResult<RunComparison>[] {
  return useQueries({
    queries: otherRunIds.map((otherRunId) => runComparisonQueryOptions(baselineRunId, otherRunId)),
  })
}
