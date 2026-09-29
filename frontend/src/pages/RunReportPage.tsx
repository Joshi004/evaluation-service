import { Link, Outlet, useParams } from 'react-router'
import { useRunDiagnostics } from '../api/queries/runDiagnostics'
import { useRun } from '../api/queries/runs'
import { BUTTON_LABEL_SIZE, buttonClassName } from '../components/Button/Button.helper'
import { EmptyState } from '../components/EmptyState/EmptyState'
import { ErrorState } from '../components/ErrorState/ErrorState'
import { RunReportHeader } from '../components/RunReportHeader/RunReportHeader'
import { RunReportSkeleton } from '../components/RunReportSkeleton/RunReportSkeleton'
import { RunVerdictBand } from '../components/RunVerdictBand/RunVerdictBand'
import { TabNav } from '../components/TabNav/TabNav'
import { isNotFoundError } from '../utils/isNotFoundError'
import { paths } from '../utils/paths'
import { buildRunReportTabs, type RunReportContext } from './RunReportPage.helper'

// The run report (docs/UI_REDESIGN_PLAN.md §8.7): replaces
// RunDetailPage, RunDiagnosticsPage and RunSamplePage with one page --
// a state-aware verdict, then tabs for Samples, Configuration and Logs,
// all sharing this one already-loaded run through the outlet context
// (RunReportPage.helper.ts's useRunReport). Diagnostics is fetched once
// here too (only once the run is `done` -- the endpoint 409s otherwise)
// so both the verdict band's health chips and the Samples tab badge
// read the same query instead of each triggering their own.
export function RunReportPage() {
  const { runId } = useParams<{ runId: string }>()
  const id = Number(runId)

  const run = useRun(id)
  const diagnostics = useRunDiagnostics(id, { enabled: run.data?.status === 'done' })

  if (!Number.isFinite(id) || (run.isError && isNotFoundError(run.error))) {
    return (
      <EmptyState
        title="Run not found"
        description="It may have been removed, or the link has a typo."
        actions={
          <Link to={paths.runs()} className={buttonClassName('primary', BUTTON_LABEL_SIZE.md)}>
            Back to Runs
          </Link>
        }
      />
    )
  }

  if (run.isLoading) {
    return <RunReportSkeleton />
  }

  if (run.isError) {
    return (
      <ErrorState message="Could not load this run" details={String(run.error)} onRetry={() => run.refetch()} />
    )
  }

  if (!run.data) {
    return null
  }

  const context: RunReportContext = { run: run.data, diagnostics }

  return (
    <div className="space-y-6">
      <RunReportHeader run={run.data} />
      {run.data.status === 'done' && <RunVerdictBand run={run.data} diagnostics={diagnostics} />}
      <TabNav items={buildRunReportTabs(run.data.id, diagnostics.data?.summary.failed)} />
      <Outlet context={context} />
    </div>
  )
}
