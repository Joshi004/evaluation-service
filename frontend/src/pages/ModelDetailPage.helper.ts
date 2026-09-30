// Non-DOM logic for ModelDetailPage.tsx: the context every tab route
// reads the already-loaded checkpoint (plus the full checkpoint list,
// standards and leaderboard board it needs to derive its own results,
// lineage and comparisons) through -- mirrors RunReportPage.helper.ts's
// own split. Kept out of the component body per
// .cursor/rules/frontend-components.mdc.

import { useOutletContext } from 'react-router'
import type { CheckpointDetail, CheckpointListItem, RunListItem, StandardSummary } from '../api/client'
import type { LeaderboardBoard } from '../utils/buildLeaderboard'
import { paths } from '../utils/paths'

export interface ModelPageContext {
  // Always loaded by the time a tab route renders -- ModelDetailPage
  // only mounts its <Outlet> once every query below has data (see its
  // own loading and error states).
  checkpoint: CheckpointDetail
  allCheckpoints: CheckpointListItem[]
  standards: StandardSummary[]
  board: LeaderboardBoard
  // Every run for this checkpoint (GET /runs?checkpoint_id=), not the
  // sidebar's unfiltered cache -- the Runs tab's own status filter and
  // the tab strip's own count badge both read this one query.
  runs: RunListItem[]
}

export function useModelPage(): ModelPageContext {
  return useOutletContext<ModelPageContext>()
}

export interface ModelPageTabItem {
  to: string
  label: string
  end?: boolean
  badge?: number
}

// "Results · Runs (count) · Configuration · Lineage" (docs/UI_REDESIGN_PLAN.md
// §8.11's own architecture sketch) -- mirrors RunReportPage.helper.ts's
// own buildRunReportTabs, one tab-strip builder per detail page.
export function buildModelPageTabs(modelId: number, runCount: number): ModelPageTabItem[] {
  return [
    { to: paths.model(modelId), label: 'Results', end: true },
    { to: paths.modelRuns(modelId), label: 'Runs', badge: runCount },
    { to: paths.modelConfig(modelId), label: 'Configuration' },
    { to: paths.modelLineage(modelId), label: 'Lineage' },
  ]
}
