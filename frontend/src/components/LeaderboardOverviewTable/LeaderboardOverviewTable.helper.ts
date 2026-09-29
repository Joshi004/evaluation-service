import type { LeaderboardSetupsMode, ResolvedLeaderboardView } from '../../pages/LeaderboardPage.helper'
import { resolveSetupForBenchmark } from '../../pages/LeaderboardPage.helper'
import type { BenchmarkColumn, SetupOption } from '../../utils/buildLeaderboard'

// One leaf column in Like-for-like mode (the column's own resolved
// setup); one per setup in All-setups mode (§8.6 item 3: "expands a
// benchmark into one sub-column per setup").
export function leafSetupsForColumn(
  column: BenchmarkColumn,
  mode: LeaderboardSetupsMode,
  setupOverrides: Record<string, string>,
): SetupOption[] {
  return mode === 'all' ? column.setups : [resolveSetupForBenchmark(column, setupOverrides)]
}

export function totalLeafColumns(columns: BenchmarkColumn[], mode: LeaderboardSetupsMode): number {
  return columns.reduce((sum, column) => sum + (mode === 'all' ? column.setups.length : 1), 0)
}

// Fixed row heights (independent of the `density` toggle, which only
// affects body rows) so every header `<th>`'s own `top-*` offset is a
// constant known ahead of render, not something recomputed from actual
// DOM measurements. Row 3 (the per-setup sub-header) only exists in
// All-setups mode.
export const HEADER_ROW1_HEIGHT_CLASS = 'h-9'
export const HEADER_ROW2_HEIGHT_CLASS = 'h-11'
export const HEADER_ROW3_HEIGHT_CLASS = 'h-9'
export const HEADER_ROW1_TOP_CLASS = 'top-0'
// h-9 = 36px
export const HEADER_ROW2_TOP_CLASS = 'top-9'
// h-9 + h-11 = 36px + 44px = 80px = 20 spacing units
export const HEADER_ROW3_TOP_CLASS = 'top-20'

export function isActiveLeafSetup(column: BenchmarkColumn, setup: SetupOption, view: ResolvedLeaderboardView): boolean {
  return resolveSetupForBenchmark(column, view.setupOverrides).comparisonHash === setup.comparisonHash
}
