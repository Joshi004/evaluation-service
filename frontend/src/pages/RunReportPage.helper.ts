// Non-DOM logic for RunReportPage.tsx: the context every tab route
// reads the already-loaded run (and its diagnostics query) through --
// no tab repeats the run's loading state -- and the tab strip's own
// item list. Kept out of the component body per
// .cursor/rules/frontend-components.mdc.

import { useOutletContext } from 'react-router'
import type { UseQueryResult } from '@tanstack/react-query'
import type { RunDetail, RunDiagnostics } from '../api/client'
import { paths } from '../utils/paths'

export interface RunReportContext {
  // Always loaded by the time a tab route renders -- RunReportPage only
  // mounts its <Outlet> once run.data exists (see its own loading and
  // error states).
  run: RunDetail
  // The full query result, not just RunDiagnostics | undefined: the
  // Overview and Samples tabs each need isLoading/isError to render
  // their own skeleton or ErrorState. Disabled (a non-done run) reads
  // as isLoading === false, data === undefined, which every tab already
  // treats the same as "nothing to show yet".
  diagnostics: UseQueryResult<RunDiagnostics>
}

export function useRunReport(): RunReportContext {
  return useOutletContext<RunReportContext>()
}

export interface RunReportTabItem {
  to: string
  label: string
  end?: boolean
  badge?: number
}

// "Overview | Samples (79) | Configuration | Logs" -- the failed count
// only ever appears once diagnostics has actually loaded (a queued,
// running, failed or cancelled run has none to count), so
// `failedCount` stays optional rather than showing a misleading "(0)"
// before it is known.
export function buildRunReportTabs(runId: number, failedCount: number | undefined): RunReportTabItem[] {
  return [
    { to: paths.run(runId), label: 'Overview', end: true },
    { to: paths.runSamples(runId), label: 'Samples', badge: failedCount },
    { to: paths.runConfig(runId), label: 'Configuration' },
    { to: paths.runLogs(runId), label: 'Logs' },
  ]
}
