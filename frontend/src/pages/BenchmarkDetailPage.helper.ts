// Non-DOM logic for BenchmarkDetailPage.tsx: the context every tab
// route reads the already-loaded standard (plus the full checkpoint
// list, the board it's ranked in, and its own scoped runs) through --
// mirrors ModelDetailPage.helper.ts's own split.

import { useOutletContext } from 'react-router'
import type { CheckpointListItem, RunListItem, StandardSummary } from '../api/client'
import type { LeaderboardBoard } from '../utils/buildLeaderboard'
import { paths } from '../utils/paths'

export interface BenchmarkPageContext {
  // Always loaded by the time a tab route renders -- BenchmarkDetailPage
  // only mounts its <Outlet> once every query below has data (see its
  // own loading and error states).
  standard: StandardSummary
  allCheckpoints: CheckpointListItem[]
  board: LeaderboardBoard
  // Every run for this standard (GET /runs?standard_id=), not the
  // sidebar's unfiltered cache -- the Runs tab's own status filter and
  // the tab strip's own count badge both read this one query.
  runs: RunListItem[]
}

export function useBenchmarkPage(): BenchmarkPageContext {
  return useOutletContext<BenchmarkPageContext>()
}

export interface BenchmarkPageTabItem {
  to: string
  label: string
  end?: boolean
  badge?: number
}

// "Overview · Protocol · Runs (count)" -- mirrors
// ModelDetailPage.helper.ts's own buildModelPageTabs, one tab-strip
// builder per detail page.
export function buildBenchmarkPageTabs(benchmarkId: number, runCount: number): BenchmarkPageTabItem[] {
  return [
    { to: paths.benchmark(benchmarkId), label: 'Overview', end: true },
    { to: paths.benchmarkProtocol(benchmarkId), label: 'Protocol' },
    { to: paths.benchmarkRuns(benchmarkId), label: 'Runs', badge: runCount },
  ]
}
