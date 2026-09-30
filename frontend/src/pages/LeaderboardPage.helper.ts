// Non-DOM logic for LeaderboardPage.tsx (docs/UI_REDESIGN_PLAN.md §8.6):
// resolving the URL into a typed view (with data-dependent defaults --
// "the benchmark with the most results", "the setup with the most
// models" -- omitted from the URL per §4.5), filtering, the one sort
// comparator with missing values always last, and the CSV export rows.
//
// This page does not reuse utils/useUrlState.ts's generic hook: that
// hook needs every param's default known statically (it is one value,
// fixed at the call site), but `sort`, `dir` and every `setup.<benchmark>`
// key here default to something computed from the loaded board. Reading
// goes through the same plain-function readers useUrlState.ts already
// exports (readStringParam, readEnumParam, ...); writing goes through
// applyLeaderboardParamChanges below, which follows the same "delete a
// key that has been set back to its default" rule by construction --
// every call site passes `null` once a value equals whatever this file
// just resolved as the default.
import type { BenchmarkColumn, LeaderboardBoard, ModelRow, SetupOption } from '../utils/buildLeaderboard'
import { groupColumnsByCategory } from '../utils/buildLeaderboard'
import { NO_FAMILY_KEY } from '../utils/familyGroups'
import { readBooleanParam, readEnumParam, readListParam, readStringParam } from '../utils/useUrlState'

export type LeaderboardLens = 'overview' | 'benchmark'
export type LeaderboardSetupsMode = 'like' | 'all'
export type LeaderboardDensity = 'comfortable' | 'compact'
export type SortDirection = 'asc' | 'desc'

const LENS_VALUES = ['overview', 'benchmark'] as const
const MODE_VALUES = ['like', 'all'] as const
const DENSITY_VALUES = ['comfortable', 'compact'] as const
const SETUP_PARAM_PREFIX = 'setup.'

// One row-height preset per density, shared by both lenses' tables (the
// URL's `density` param, unlike `bench`/`mode`/`heat`, is not scoped to
// Overview -- see this phase's plan) so "compact" means the same thing
// in both places.
export const DENSITY_CELL_PADDING: Record<LeaderboardDensity, string> = {
  comfortable: 'px-3 py-3',
  compact: 'px-2 py-1.5',
}

export function setupParamKey(benchmark: string): string {
  return `${SETUP_PARAM_PREFIX}${benchmark}`
}

function readSetupOverrides(params: URLSearchParams): Record<string, string> {
  const overrides: Record<string, string> = {}
  for (const [key, value] of params.entries()) {
    if (key.startsWith(SETUP_PARAM_PREFIX) && value !== '') {
      overrides[key.slice(SETUP_PARAM_PREFIX.length)] = value
    }
  }
  return overrides
}

// Best-first direction for a column's own metric -- shared by the
// resolved view's own default, by nextSortState's "clicked a different
// header" branch, and by the page's own "picked a different benchmark
// in the By-benchmark selector" handler, so all three can never
// disagree about what "default" means for a given benchmark.
export function defaultDirectionForColumn(column: BenchmarkColumn | undefined): SortDirection {
  return column?.higherIsBetter === false ? 'asc' : 'desc'
}

function totalResultsFor(column: BenchmarkColumn): number {
  return column.setups.reduce((sum, setup) => sum + setup.modelCount, 0)
}

// "The benchmark with the most results" (§8.6 item 3's default-sort
// rule) among whichever columns are actually visible -- Overview's own
// Benchmarks filter can hide the very column that would otherwise win.
function defaultSortBenchmark(visibleColumns: BenchmarkColumn[]): string {
  if (visibleColumns.length === 0) {
    return ''
  }
  let best = visibleColumns[0]
  let bestTotal = totalResultsFor(best)
  for (const column of visibleColumns.slice(1)) {
    const total = totalResultsFor(column)
    if (total > bestTotal) {
      best = column
      bestTotal = total
    }
  }
  return best.benchmark
}

export interface FilterOption {
  value: string
  label: string
}

export interface FilterOptionGroup {
  heading?: string
  options: FilterOption[]
}

// Benchmarks grouped by category, shaped for MultiSelectMenu -- built
// from every column, not the currently visible ones, since narrowing
// the filter's own option list by its current value would make it
// impossible to add a hidden benchmark back in.
export function buildBenchmarkFilterGroups(columns: BenchmarkColumn[]): FilterOptionGroup[] {
  return groupColumnsByCategory(columns).map((group) => ({
    heading: group.category ?? 'Uncategorised',
    options: group.columns.map((column) => ({ value: column.benchmark, label: column.displayName })),
  }))
}

export function filterColumnsByBenchSelection(columns: BenchmarkColumn[], benchFilter: string[]): BenchmarkColumn[] {
  if (benchFilter.length === 0) {
    return columns
  }
  return columns.filter((column) => benchFilter.includes(column.benchmark))
}

export interface ResolvedLeaderboardView {
  lens: LeaderboardLens
  q: string
  familyFilter: string[]
  benchFilter: string[]
  mode: LeaderboardSetupsMode
  density: LeaderboardDensity
  heatEnabled: boolean
  setupOverrides: Record<string, string>
  // Which benchmark is highlighted: the sorted column in Overview, the
  // board on display in By-benchmark (§8.6 item 3's own "switching
  // lens keeps the same benchmark in focus" design).
  sortBenchmark: string
  dir: SortDirection
  // Overview-only (the Benchmarks filter does not apply to
  // By-benchmark, which can show any board regardless).
  visibleColumns: BenchmarkColumn[]
  sortColumn: BenchmarkColumn | undefined
}

export function resolveLeaderboardView(params: URLSearchParams, board: LeaderboardBoard): ResolvedLeaderboardView {
  const lens = readEnumParam(params, 'lens', LENS_VALUES, 'overview')
  const q = readStringParam(params, 'q') ?? ''
  const familyFilter = readListParam(params, 'family')
  const benchFilter = readListParam(params, 'bench')
  const mode = readEnumParam(params, 'mode', MODE_VALUES, 'like')
  const density = readEnumParam(params, 'density', DENSITY_VALUES, 'comfortable')
  const heatEnabled = readBooleanParam(params, 'heat', true)
  const setupOverrides = readSetupOverrides(params)

  const visibleColumns = filterColumnsByBenchSelection(board.columns, benchFilter)
  // By-benchmark ignores the Benchmarks filter (§8.6's URL contract:
  // `bench` is Overview-only) -- its own board selector can name any
  // benchmark, not just a visible Overview column.
  const columnsForSort = lens === 'overview' ? visibleColumns : board.columns

  const sortParam = readStringParam(params, 'sort')
  const sortBenchmark =
    sortParam !== null && columnsForSort.some((column) => column.benchmark === sortParam)
      ? sortParam
      : defaultSortBenchmark(columnsForSort)
  const sortColumn = columnsForSort.find((column) => column.benchmark === sortBenchmark)

  const dirParam = readStringParam(params, 'dir')
  const dir: SortDirection = dirParam === 'asc' || dirParam === 'desc' ? dirParam : defaultDirectionForColumn(sortColumn)

  return { lens, q, familyFilter, benchFilter, mode, density, heatEnabled, setupOverrides, sortBenchmark, dir, visibleColumns, sortColumn }
}

// The override for this benchmark if the URL names one of its actual
// setups, else the column's own default (most models, ties -> most
// recent -- baked into `setups`' own sort order by buildLeaderboard.ts).
export function resolveSetupForBenchmark(column: BenchmarkColumn, setupOverrides: Record<string, string>): SetupOption {
  const overrideHash = setupOverrides[column.benchmark]
  const overrideSetup = overrideHash ? column.setups.find((setup) => setup.comparisonHash === overrideHash) : undefined
  // Safe without a fallback to `undefined`: buildLeaderboard.ts never
  // produces a column with an empty `setups` array (see its own
  // comment on `defaultComparisonHash`).
  return overrideSetup ?? column.setups[0]
}

// Clicking a header: a different benchmark starts at its own
// best-first direction; the same benchmark again reverses it. Kept
// pure and separate from the click handler itself so the "same column
// twice reverses" rule is one piece of logic, not re-derived at the
// call site.
export function nextSortState(
  current: { sortBenchmark: string; dir: SortDirection },
  clickedColumn: BenchmarkColumn,
): { sortBenchmark: string; dir: SortDirection } {
  if (current.sortBenchmark !== clickedColumn.benchmark) {
    return { sortBenchmark: clickedColumn.benchmark, dir: defaultDirectionForColumn(clickedColumn) }
  }
  return { sortBenchmark: clickedColumn.benchmark, dir: current.dir === 'desc' ? 'asc' : 'desc' }
}

export function ariaSortFor(benchmark: string, view: ResolvedLeaderboardView): 'ascending' | 'descending' | 'none' {
  if (view.sortBenchmark !== benchmark) {
    return 'none'
  }
  return view.dir === 'asc' ? 'ascending' : 'descending'
}

// Search (name or family) plus the family filter -- applied in both
// lenses (only the Benchmarks filter, Setups mode and heat tint are
// Overview-only; see this phase's plan).
export function filterModels(models: ModelRow[], q: string, familyFilter: string[]): ModelRow[] {
  const query = q.trim().toLowerCase()
  return models.filter((model) => {
    if (query !== '') {
      const matchesQuery = model.name.toLowerCase().includes(query) || (model.family ?? '').toLowerCase().includes(query)
      if (!matchesQuery) {
        return false
      }
    }
    if (familyFilter.length === 0) {
      return true
    }
    const key = model.familyKey ?? NO_FAMILY_KEY
    return familyFilter.includes(key)
  })
}

// One benchmark column's score for one model, or `null` for "not
// evaluated on this setup" -- the single place both the Overview
// header-sort comparator and a future caller read a cell's raw value
// from, so "missing" is decided the same way everywhere.
function scoreFor(column: BenchmarkColumn | undefined, setupOverrides: Record<string, string>, checkpointId: number): number | null {
  if (!column) {
    return null
  }
  const setup = resolveSetupForBenchmark(column, setupOverrides)
  return setup.cellsByCheckpointId[checkpointId]?.value ?? null
}

// The Overview table's row order once a header has been clicked:
// best-first (or reversed) by the sorted column's score, with every
// "not evaluated on this setup" row pushed to the bottom regardless of
// direction (§8.6 item 3: "missing values always last") rather than
// sorting as if a missing score were zero.
export function compareModelRowsForSort(
  a: ModelRow,
  b: ModelRow,
  sortColumn: BenchmarkColumn | undefined,
  setupOverrides: Record<string, string>,
  dir: SortDirection,
): number {
  const scoreA = scoreFor(sortColumn, setupOverrides, a.checkpointId)
  const scoreB = scoreFor(sortColumn, setupOverrides, b.checkpointId)
  if (scoreA === null && scoreB === null) {
    return a.name.localeCompare(b.name)
  }
  if (scoreA === null) return 1
  if (scoreB === null) return -1
  const diff = scoreA - scoreB
  return dir === 'asc' ? diff : -diff
}

export interface LeaderboardCsvRow {
  model: string
  family: string
  benchmark: string
  setup: string
  scorePercent: string
  ciLowPercent: string
  ciHighPercent: string
  samples: string
  truncatedPercent: string
  runId: string
  finishedAt: string
}

const CSV_HEADER = [
  'Model',
  'Family',
  'Benchmark',
  'Setup',
  'Score %',
  'CI low %',
  'CI high %',
  'Samples',
  'Truncated %',
  'Run ID',
  'Finished at',
]

// A leading = + - @ makes some spreadsheet apps evaluate the cell as a
// formula (a well-known CSV-injection vector) -- neutralised with a
// leading apostrophe, the same mitigation spreadsheet apps themselves
// use for pasted text, before the field is quoted. Model and family
// names are free text a registration form accepted, so every field is
// quoted regardless of whether it happens to contain a comma today.
function sanitizeCsvField(value: string): string {
  const neutralized = /^[=+\-@]/.test(value) ? `'${value}` : value
  return `"${neutralized.replace(/"/g, '""')}"`
}

function csvRowToLine(row: LeaderboardCsvRow): string {
  return [
    row.model,
    row.family,
    row.benchmark,
    row.setup,
    row.scorePercent,
    row.ciLowPercent,
    row.ciHighPercent,
    row.samples,
    row.truncatedPercent,
    row.runId,
    row.finishedAt,
  ]
    .map(sanitizeCsvField)
    .join(',')
}

export function buildLeaderboardCsvText(rows: LeaderboardCsvRow[]): string {
  return [CSV_HEADER.join(','), ...rows.map(csvRowToLine)].join('\r\n')
}

// Exactly what is on screen (§8.6 item 8): the same model filter, the
// same lens, and -- in Overview -- the same Benchmarks filter and
// Setups mode a reader is currently looking at. "Run it" and "not
// evaluated" cells have no score to export, so they contribute no row.
export function buildLeaderboardCsvRows(board: LeaderboardBoard, view: ResolvedLeaderboardView): LeaderboardCsvRow[] {
  const visibleModels = filterModels(board.models, view.q, view.familyFilter)
  const columnsToExport = view.lens === 'overview' ? view.visibleColumns : view.sortColumn ? [view.sortColumn] : []

  const rows: LeaderboardCsvRow[] = []
  for (const column of columnsToExport) {
    const setupsToExport =
      view.lens === 'overview' && view.mode === 'all' ? column.setups : [resolveSetupForBenchmark(column, view.setupOverrides)]

    for (const setup of setupsToExport) {
      const setupLabel = setup.samplingProfileLabel ?? setup.samplingProfileHash
      for (const model of visibleModels) {
        const cell = setup.cellsByCheckpointId[model.checkpointId]
        if (!cell) {
          continue
        }
        rows.push({
          model: model.name,
          family: model.family ?? '',
          benchmark: column.displayName,
          setup: setupLabel,
          scorePercent: (cell.value * 100).toFixed(1),
          ciLowPercent: cell.confidenceInterval ? (cell.confidenceInterval.lower * 100).toFixed(1) : '',
          ciHighPercent: cell.confidenceInterval ? (cell.confidenceInterval.upper * 100).toFixed(1) : '',
          samples: cell.nSamples === null ? '' : String(cell.nSamples),
          truncatedPercent: cell.truncationRate === null ? '' : (cell.truncationRate * 100).toFixed(1),
          runId: String(cell.evalRunId),
          finishedAt: cell.finishedAt,
        })
      }
    }
  }
  return rows
}

// Batches several query-param changes into one URLSearchParams update
// (React Router does not queue multiple setSearchParams calls made
// within the same tick -- utils/useUrlState.ts's own module comment).
// `null` deletes the key -- every call site passes that once a value
// equals whatever resolveLeaderboardView just resolved as the default,
// which is what keeps defaults out of the URL (§4.5).
export function applyLeaderboardParamChanges(
  previous: URLSearchParams,
  changes: Record<string, string | null>,
): URLSearchParams {
  const next = new URLSearchParams(previous)
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === '') {
      next.delete(key)
    } else {
      next.set(key, value)
    }
  }
  return next
}
