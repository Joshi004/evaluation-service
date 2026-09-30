// Non-DOM logic for RunsPage.tsx: the URL contract, filtering an
// already-fetched run list in the browser (no server-side filter
// exists for `by`/`since`/`q`, and the status counts need the
// unfiltered list anyway), the per-chip status counts, the filter
// option lists built from whatever the current runs actually contain,
// and the one newest-first sort every view (grouped or flat) uses.

import type { RunListItem, StandardSummary } from '../api/client'
import { benchmarkDisplayName } from '../utils/benchmarkDisplayName'
import {
  countRunsByStatus,
  matchesRunsStatusFilter,
  RUNS_STATUS_FILTER_VALUES,
  type RunsStatusCounts,
  type RunsStatusFilter,
} from '../utils/runStatus'
import { readEnumParam, readNumberParam, readStringParam, type UrlParamValue } from '../utils/useUrlState'

export type { RunsStatusCounts, RunsStatusFilter }

const SINCE_VALUES = ['24h', '7d', '30d', 'all'] as const
export type RunsSincePreset = (typeof SINCE_VALUES)[number]

const VIEW_VALUES = ['batches', 'flat'] as const
export type RunsViewMode = (typeof VIEW_VALUES)[number]

// The domain shape every filter predicate below reads -- `null` means
// "don't narrow by this", matching RunListFilters' own convention on
// the backend, except `status`/`since` stay explicit enums (there is
// always a selected segment/date preset on screen, never an absent
// one) rather than nullable.
export interface RunsFilters {
  status: RunsStatusFilter
  modelId: number | null
  benchmark: string | null
  submittedBy: string | null
  since: RunsSincePreset
  q: string
  batchId: number | null
}

export interface ResolvedRunsView {
  filters: RunsFilters
  viewMode: RunsViewMode
}

// The raw shape RunsPage.tsx hands to useUrlState (this is the first
// page to use that hook, because every default here is a constant --
// unlike the Leaderboard's own data-dependent defaults, nothing here
// needs the loaded runs to know what "unset" looks like).
// Keys match the URL's own param names (`model`, `by`, `batch`), not
// RunsFilters' domain names (`modelId`, `submittedBy`, `batchId`) --
// resolveRunsView below is what translates between the two.
//
// The index signature is only here to satisfy useUrlState's own
// `T extends Record<string, UrlParamValue>` constraint -- TypeScript
// does not infer one for a plain interface, even though every named
// field below is already a UrlParamValue; every real call site still
// reads and writes through the named fields, never the index.
export interface RunsUrlParams {
  [key: string]: UrlParamValue
  status: RunsStatusFilter
  model: number | null
  benchmark: string | null
  by: string | null
  since: RunsSincePreset
  q: string
  batch: number | null
  view: RunsViewMode
}

export const RUNS_URL_DEFAULTS: RunsUrlParams = {
  status: 'all',
  model: null,
  benchmark: null,
  by: null,
  since: 'all',
  q: '',
  batch: null,
  view: 'batches',
}

export function resolveRunsView(params: URLSearchParams): ResolvedRunsView {
  const status = readEnumParam(params, 'status', RUNS_STATUS_FILTER_VALUES, 'all')
  const modelId = readNumberParam(params, 'model')
  const benchmark = readStringParam(params, 'benchmark')
  const submittedBy = readStringParam(params, 'by')
  const since = readEnumParam(params, 'since', SINCE_VALUES, 'all')
  const q = readStringParam(params, 'q') ?? ''
  const batchId = readNumberParam(params, 'batch')
  const viewMode = readEnumParam(params, 'view', VIEW_VALUES, 'batches')

  return {
    filters: { status, modelId, benchmark, submittedBy, since, q, batchId },
    viewMode,
  }
}

const SINCE_WINDOW_MS: Record<Exclude<RunsSincePreset, 'all'>, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

function matchesSincePreset(run: RunListItem, since: RunsSincePreset, now: Date): boolean {
  if (since === 'all') {
    return true
  }
  const elapsedMs = now.getTime() - new Date(run.created_at).getTime()
  return elapsedMs < SINCE_WINDOW_MS[since]
}

// Batch name or model name, not benchmark or submitted-by -- those
// already have their own dedicated filters.
function matchesSearchQuery(run: RunListItem, q: string): boolean {
  const query = q.trim().toLowerCase()
  if (query === '') {
    return true
  }
  return run.run_group_name.toLowerCase().includes(query) || run.checkpoint_name.toLowerCase().includes(query)
}

// Every filter except status -- the status chips' own counts need this
// (a chip counts what it would show if picked, not what's already
// showing), and the full filter below composes it with the status
// check so the two can never read a run differently.
function matchesRunsFiltersExceptStatus(run: RunListItem, filters: RunsFilters, now: Date): boolean {
  if (filters.modelId !== null && run.checkpoint_id !== filters.modelId) {
    return false
  }
  if (filters.benchmark !== null && run.benchmark !== filters.benchmark) {
    return false
  }
  if (filters.submittedBy !== null && run.submitted_by !== filters.submittedBy) {
    return false
  }
  if (filters.batchId !== null && run.run_group_id !== filters.batchId) {
    return false
  }
  if (!matchesSincePreset(run, filters.since, now)) {
    return false
  }
  return matchesSearchQuery(run, filters.q)
}

export function filterRuns(runs: RunListItem[], filters: RunsFilters, now: Date): RunListItem[] {
  return runs.filter(
    (run) => matchesRunsStatusFilter(run, filters.status) && matchesRunsFiltersExceptStatus(run, filters, now),
  )
}

// Each count is "how many runs would show if this chip were picked,
// given every other filter already on" -- with no filters at all,
// this is simply how many runs the service has of each status.
// Delegates the actual counting to runStatus.ts's countRunsByStatus
// once the other filters have narrowed the list.
export function countRunsByStatusFilter(runs: RunListItem[], filters: RunsFilters, now: Date): RunsStatusCounts {
  const otherwiseVisible = runs.filter((run) => matchesRunsFiltersExceptStatus(run, filters, now))
  return countRunsByStatus(otherwiseVisible)
}

// GET /runs already orders by created_at desc, but two runs submitted
// in the same grid share one identical `created_at` (batch 9's runs 15
// and 16) -- id descending is what still puts the newer one (#16) on
// top in that case, in both the grouped and flat views.
export function compareRunsNewestFirst(a: RunListItem, b: RunListItem): number {
  const createdDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  return createdDiff !== 0 ? createdDiff : b.id - a.id
}

export interface ModelFilterOption {
  checkpointId: number
  name: string
}

// Built from whichever runs are currently loaded, not a separate
// /checkpoints call -- this page already has everything it needs in
// one request. A `selectedModelId` with no matching run (a stale link)
// still gets an option, so the control never shows a blank where the
// URL named something.
export function buildModelFilterOptions(runs: RunListItem[], selectedModelId: number | null): ModelFilterOption[] {
  const nameByCheckpointId = new Map<number, string>()
  for (const run of runs) {
    if (!nameByCheckpointId.has(run.checkpoint_id)) {
      nameByCheckpointId.set(run.checkpoint_id, run.checkpoint_name)
    }
  }
  if (selectedModelId !== null && !nameByCheckpointId.has(selectedModelId)) {
    nameByCheckpointId.set(selectedModelId, `Model ${selectedModelId}`)
  }
  return [...nameByCheckpointId.entries()]
    .map(([checkpointId, name]) => ({ checkpointId, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export interface BenchmarkFilterOption {
  benchmark: string
  label: string
}

export function buildBenchmarkFilterOptions(
  runs: RunListItem[],
  standards: StandardSummary[],
  selectedBenchmark: string | null,
): BenchmarkFilterOption[] {
  const benchmarks = new Set(runs.map((run) => run.benchmark))
  if (selectedBenchmark !== null) {
    benchmarks.add(selectedBenchmark)
  }
  return [...benchmarks]
    .map((benchmark) => ({ benchmark, label: benchmarkDisplayName(benchmark, standards) }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export interface SubmittedByFilterOption {
  value: string
  label: string
}

// Empty and null submitted_by values (runs 11-13, per the real data
// snapshot) are never offered as a filter choice -- there is no "empty"
// label worth picking from a dropdown; a row with no submitter still
// renders "—" regardless of this filter.
export function buildSubmittedByFilterOptions(
  runs: RunListItem[],
  selected: string | null,
): SubmittedByFilterOption[] {
  const values = new Set<string>()
  for (const run of runs) {
    if (run.submitted_by !== null && run.submitted_by !== '') {
      values.add(run.submitted_by)
    }
  }
  if (selected !== null) {
    values.add(selected)
  }
  return [...values].sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value }))
}

export interface SinceFilterOption {
  value: RunsSincePreset
  label: string
}

// Static, unlike the other filter option lists -- a date preset's
// meaning doesn't depend on which runs happen to be loaded.
export const SINCE_FILTER_OPTIONS: SinceFilterOption[] = [
  { value: 'all', label: 'Any time' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
]

// Drives the toolbar's own "Clear filters" control -- true the moment
// any filter (status included: an "All" view is the only state with
// nothing to clear) differs from its default.
export function hasActiveFilters(filters: RunsFilters): boolean {
  return (
    filters.status !== 'all' ||
    filters.modelId !== null ||
    filters.benchmark !== null ||
    filters.submittedBy !== null ||
    filters.since !== 'all' ||
    filters.q !== '' ||
    filters.batchId !== null
  )
}

// The empty-state copy's own special case: "Nothing is running right
// now" reads better than a generic "no matches" when Active is the
// *only* thing narrowing the list.
export function isOnlyActiveStatusFilter(filters: RunsFilters): boolean {
  return (
    filters.status === 'active' &&
    filters.modelId === null &&
    filters.benchmark === null &&
    filters.submittedBy === null &&
    filters.since === 'all' &&
    filters.q === '' &&
    filters.batchId === null
  )
}
