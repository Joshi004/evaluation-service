import { useNavigate } from 'react-router'
import { BreakdownPreview } from '../components/BreakdownPreview/BreakdownPreview'
import { Card } from '../components/Card/Card'
import { DiagnosticsSummary } from '../components/DiagnosticsSummary/DiagnosticsSummary'
import { ErrorState } from '../components/ErrorState/ErrorState'
import { RunFailurePanel } from '../components/RunFailurePanel/RunFailurePanel'
import { RunHealthDetails } from '../components/RunHealthDetails/RunHealthDetails'
import { RunLiveProgress } from '../components/RunLiveProgress/RunLiveProgress'
import { RunMetricCards } from '../components/RunMetricCards/RunMetricCards'
import { Skeleton } from '../components/Skeleton/Skeleton'
import { paths } from '../utils/paths'
import { isActiveRunStatus } from '../utils/runStatus'
import { useRunReport } from './RunReportPage.helper'

// The run report's own state-aware default tab
// (docs/UI_REDESIGN_PLAN.md §8.7, item 7): live progress while
// queued/running, "what went wrong" first while failed/cancelled, or
// the full done view -- metric cards, a breakdown preview, the written
// narrative and health details -- once finished.
export function RunOverviewTab() {
  const { run, diagnostics } = useRunReport()
  const navigate = useNavigate()

  if (isActiveRunStatus(run.status)) {
    return <RunLiveProgress run={run} />
  }
  if (run.status === 'failed' || run.status === 'cancelled') {
    return <RunFailurePanel run={run} />
  }

  const performance = run.performance
  if (performance === null) {
    // Not expected for a `done` run (the backend always computes this
    // from results_json once a run finishes) -- a defensive fallback
    // rather than a crash if it ever is.
    return <p className="text-sm text-muted-foreground">No results recorded for this run yet.</p>
  }

  // The Overview tab's own tag chips (inside DiagnosticsSummary) link
  // out to the Samples tab's filter rather than toggling in place --
  // docs/UI_REDESIGN_PLAN.md §8.7, item 3: "tag chips that link to
  // filtered Samples".
  function handleTagChange(tag: string | null): void {
    const path = paths.runSamples(run.id)
    navigate(tag === null ? path : `${path}?tag=${encodeURIComponent(tag)}`)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <h2 className="text-sm font-medium text-foreground">All metrics</h2>
          <div className="mt-3">
            <RunMetricCards metrics={performance.metrics} />
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-medium text-foreground">Where the points went</h2>
          <div className="mt-3">
            {diagnostics.isLoading && <Skeleton className="h-24 w-full" />}
            {diagnostics.isError && (
              <ErrorState
                message="Could not load the breakdown"
                details={String(diagnostics.error)}
                onRetry={() => diagnostics.refetch()}
              />
            )}
            {diagnostics.data && <BreakdownPreview runId={run.id} buckets={diagnostics.data.buckets} />}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-medium text-foreground">What the data says</h2>
          <div className="mt-3">
            {diagnostics.isLoading && <Skeleton className="h-24 w-full" />}
            {diagnostics.isError && (
              <ErrorState
                message="Could not load the summary"
                details={String(diagnostics.error)}
                onRetry={() => diagnostics.refetch()}
              />
            )}
            {diagnostics.data && (
              <DiagnosticsSummary
                summary={diagnostics.data.summary}
                activeTag={null}
                onTagChange={handleTagChange}
              />
            )}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-medium text-foreground">Health details</h2>
        <div className="mt-3">
          <RunHealthDetails
            truncationRate={run.truncation_rate}
            performance={performance}
            diagnostics={diagnostics}
          />
        </div>
      </Card>
    </div>
  )
}
