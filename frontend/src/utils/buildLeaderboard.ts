// Turns the API's flat (checkpoint, comparison_hash) rows into the
// Leaderboard's own board shape: benchmarks as columns, each with one
// SetupOption per comparison_hash, each cell ranked against its peers
// on that same setup. The backend deliberately returns rows, not a
// pre-pivoted grid (docs/IMPLEMENTATION_PHASES.md) -- this is that
// pivot, rewritten for Phase 6 (docs/UI_REDESIGN_PLAN.md §8.6) to key
// on benchmark + setup instead of the old one-column-per-hash grid.
import type { CheckpointListItem, ConfidenceInterval, LeaderboardRow, StandardSummary } from '../api/client'
import { benchmarkDisplayName, benchmarkVersion } from './benchmarkDisplayName'
import { familyKey } from './familyKey'
import { rankScores, type RankedScore } from './rankScores'

// Rows are every registered model (so a model with no results yet still
// gets a "Run it" row), plus a defensive fallback for a checkpoint_id a
// leaderboard row names that GET /checkpoints no longer returns.
export interface ModelRow {
  checkpointId: number
  name: string
  family: string | null
  familyKey: string | null
}

export interface ScoreCellData {
  evalRunId: number
  value: number
  confidenceInterval: ConfidenceInterval | null
  nSamples: number | null
  truncationRate: number | null
  finishedAt: string
  servingProfileLabel: string | null
  servingProfileHash: string
  rank: number
  isLeader: boolean
  withinLeaderMargin: boolean
  // 1 (coolest) to 5 (warmest) -- the leader and everyone within its
  // margin of error always share level 5, so noise within the margin
  // never reads as a gradient (buildHeatLevels below).
  heatLevel: number
}

export interface SetupOption {
  comparisonHash: string
  samplingProfileLabel: string | null
  samplingProfileHash: string
  standardId: number
  standardLabel: string | null
  modelCount: number
  latestFinishedAt: string
  cellsByCheckpointId: Record<number, ScoreCellData>
}

export interface BenchmarkColumn {
  benchmark: string
  displayName: string
  category: string | null
  higherIsBetter: boolean
  setups: SetupOption[]
  // Always `setups[0]` -- exposed separately so a caller doesn't need
  // to know that "most models, ties broken by most recent" is encoded
  // as the sort order of `setups` itself.
  defaultComparisonHash: string
  // True when this benchmark's setups carry more than one standard
  // version (e.g. ifeval/v1 vs ifeval/v2 both under the same sampling
  // profile) -- the setup label alone can't tell those two apart, so
  // the UI shows the version badge only when it would actually
  // disambiguate something.
  hasMultipleStandardVersions: boolean
}

// Used by the URL's `family=none` value (§8.6's URL contract) for
// checkpoints with no family string at all.
export const NO_FAMILY_KEY = 'none'

export interface FamilyOption {
  key: string
  label: string
}

export interface LeaderboardBoard {
  columns: BenchmarkColumn[]
  models: ModelRow[]
  familyOptions: FamilyOption[]
}

function higherIsBetterForBenchmark(benchmark: string, standards: StandardSummary[]): boolean {
  const standard = standards.find((candidate) => candidate.benchmark === benchmark)
  const primaryMetric = standard?.metrics.find((metric) => metric.is_primary)
  // No standard on file for this benchmark (or no metric flagged
  // primary) is not expected in practice, but "higher is better" is
  // the safer default of the two if it ever happens, since every
  // benchmark in this catalog today is a pass rate.
  return primaryMetric?.higher_is_better ?? true
}

// Five shades by rank position (§8.6's own "Heat tint" decision): the
// top tier (the leader plus every row within its margin of error)
// always takes the warmest shade, and whatever's left is spread
// across the remaining four from warm (just outside the leader's
// margin) to cool (last place) -- so a column with only two or three
// rows still uses a sensible pair of shades instead of defaulting
// everyone below the leader to the coolest one.
const HEAT_LEVELS = 5

function buildHeatLevels(ranked: RankedScore[]): Map<number, number> {
  const levelByCheckpointId = new Map<number, number>()
  const topTier = ranked.filter((entry) => entry.isLeader || entry.withinLeaderMargin)
  const rest = ranked.filter((entry) => !entry.isLeader && !entry.withinLeaderMargin)

  for (const entry of topTier) {
    levelByCheckpointId.set(entry.row.checkpoint_id, HEAT_LEVELS)
  }

  const remainingLevels = HEAT_LEVELS - 1
  rest.forEach((entry, index) => {
    const worstFraction = rest.length <= 1 ? 0 : index / (rest.length - 1)
    const level = Math.max(1, remainingLevels - Math.round(worstFraction * (remainingLevels - 1)))
    levelByCheckpointId.set(entry.row.checkpoint_id, level)
  })

  return levelByCheckpointId
}

function buildSetupOption(comparisonHash: string, setupRows: LeaderboardRow[], higherIsBetter: boolean): SetupOption {
  const ranked = rankScores(setupRows, comparisonHash, higherIsBetter)
  const heatLevelByCheckpointId = buildHeatLevels(ranked)

  const cellsByCheckpointId: Record<number, ScoreCellData> = {}
  for (const { row, rank, isLeader, withinLeaderMargin } of ranked) {
    cellsByCheckpointId[row.checkpoint_id] = {
      evalRunId: row.eval_run_id,
      value: row.metric_value,
      confidenceInterval: row.confidence_interval,
      nSamples: row.n_samples,
      truncationRate: row.truncation_rate,
      finishedAt: row.finished_at,
      servingProfileLabel: row.serving_profile_label,
      servingProfileHash: row.serving_profile_hash,
      rank,
      isLeader,
      withinLeaderMargin,
      heatLevel: heatLevelByCheckpointId.get(row.checkpoint_id) ?? 1,
    }
  }

  // Every row sharing a comparison_hash shares the same standard and
  // resolved sampling profile by definition (S-D5), so the first row
  // seen for this hash carries the labels for the whole setup.
  const [firstRow, ...restRows] = setupRows
  const latestFinishedAt = restRows.reduce(
    (latest, row) => (new Date(row.finished_at) > new Date(latest) ? row.finished_at : latest),
    firstRow.finished_at,
  )

  return {
    comparisonHash,
    samplingProfileLabel: firstRow.sampling_profile_label,
    samplingProfileHash: firstRow.sampling_profile_hash,
    standardId: firstRow.standard_id,
    standardLabel: firstRow.label,
    modelCount: ranked.length,
    latestFinishedAt,
    cellsByCheckpointId,
  }
}

// "Most models, ties broken by most recent" (§8.6 item 1's default-setup
// rule) -- also doubles as All-setups mode's own sub-column order,
// since the same priority reads sensibly there too: the setup most
// people are looking at first, then newest.
function compareSetupsByDefaultPriority(a: SetupOption, b: SetupOption): number {
  if (a.modelCount !== b.modelCount) {
    return b.modelCount - a.modelCount
  }
  return new Date(b.latestFinishedAt).getTime() - new Date(a.latestFinishedAt).getTime()
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    const group = groups.get(key)
    if (group) {
      group.push(item)
    } else {
      groups.set(key, [item])
    }
  }
  return groups
}

function buildColumn(benchmark: string, benchmarkRows: LeaderboardRow[], standards: StandardSummary[]): BenchmarkColumn {
  const higherIsBetter = higherIsBetterForBenchmark(benchmark, standards)
  const rowsByComparisonHash = groupBy(benchmarkRows, (row) => row.comparison_hash)

  const setups = [...rowsByComparisonHash.entries()]
    .map(([comparisonHash, setupRows]) => buildSetupOption(comparisonHash, setupRows, higherIsBetter))
    .sort(compareSetupsByDefaultPriority)

  const standardVersions = new Set(setups.map((setup) => benchmarkVersion(setup.standardLabel)))

  return {
    benchmark,
    displayName: benchmarkDisplayName(benchmark, standards),
    category: standards.find((candidate) => candidate.benchmark === benchmark)?.category ?? null,
    higherIsBetter,
    setups,
    // Safe without a fallback: buildColumn only ever runs for a
    // benchmark that had at least one row (it comes from grouping
    // `rows` itself), so `setups` is never empty.
    defaultComparisonHash: setups[0].comparisonHash,
    hasMultipleStandardVersions: standardVersions.size > 1,
  }
}

// Category first (uncategorised last), then display name -- §8.6 item
// 1's own column order rule.
function compareColumns(a: BenchmarkColumn, b: BenchmarkColumn): number {
  if (a.category === null && b.category !== null) return 1
  if (a.category !== null && b.category === null) return -1
  if (a.category !== b.category) {
    return (a.category ?? '').localeCompare(b.category ?? '')
  }
  return a.displayName.localeCompare(b.displayName)
}

function buildModelRows(rows: LeaderboardRow[], checkpoints: CheckpointListItem[]): ModelRow[] {
  const models: ModelRow[] = checkpoints.map((checkpoint) => ({
    checkpointId: checkpoint.id,
    name: checkpoint.name,
    family: checkpoint.family,
    familyKey: checkpoint.family === null ? null : familyKey(checkpoint.family),
  }))

  // Defensive: a leaderboard row can in principle name a checkpoint
  // GET /checkpoints no longer returns (one deleted after being
  // evaluated) -- shown by id rather than silently dropping its score.
  const knownCheckpointIds = new Set(checkpoints.map((checkpoint) => checkpoint.id))
  for (const row of rows) {
    if (!knownCheckpointIds.has(row.checkpoint_id)) {
      knownCheckpointIds.add(row.checkpoint_id)
      models.push({ checkpointId: row.checkpoint_id, name: `#${row.checkpoint_id}`, family: null, familyKey: null })
    }
  }

  return models.sort((a, b) => a.name.localeCompare(b.name))
}

function buildFamilyOptions(checkpoints: CheckpointListItem[]): FamilyOption[] {
  const labelByKey = new Map<string, string>()
  let hasCheckpointWithNoFamily = false

  for (const checkpoint of checkpoints) {
    if (checkpoint.family === null) {
      hasCheckpointWithNoFamily = true
      continue
    }
    const key = familyKey(checkpoint.family)
    // First spelling seen wins. Showing the single most common
    // spelling is Phase 11's own acceptance criterion for the Models
    // page; this filter only needs one stable, readable label per key.
    if (!labelByKey.has(key)) {
      labelByKey.set(key, checkpoint.family)
    }
  }

  const options = [...labelByKey.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label))

  if (hasCheckpointWithNoFamily) {
    options.push({ key: NO_FAMILY_KEY, label: 'No family' })
  }
  return options
}

export function buildLeaderboard(
  rows: LeaderboardRow[],
  checkpoints: CheckpointListItem[],
  standards: StandardSummary[],
): LeaderboardBoard {
  const rowsByBenchmark = groupBy(rows, (row) => row.benchmark)
  const columns = [...rowsByBenchmark.entries()]
    .map(([benchmark, benchmarkRows]) => buildColumn(benchmark, benchmarkRows, standards))
    .sort(compareColumns)

  return {
    columns,
    models: buildModelRows(rows, checkpoints),
    familyOptions: buildFamilyOptions(checkpoints),
  }
}

export interface BenchmarkCategoryGroup {
  category: string | null
  columns: BenchmarkColumn[]
}

// Shared by the Overview table's grouped headers and the toolbar's
// Benchmarks filter (both need "columns grouped by category", just
// mapped to a different shape afterwards) -- `columns` arrives already
// sorted category-then-name (this file's own `compareColumns`), so
// consecutive same-category columns are always adjacent and a linear
// scan is enough, no re-sort needed.
export function groupColumnsByCategory(columns: BenchmarkColumn[]): BenchmarkCategoryGroup[] {
  const groups: BenchmarkCategoryGroup[] = []
  for (const column of columns) {
    const currentGroup = groups[groups.length - 1]
    if (currentGroup && currentGroup.category === column.category) {
      currentGroup.columns.push(column)
    } else {
      groups.push({ category: column.category, columns: [column] })
    }
  }
  return groups
}
